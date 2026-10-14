/**
 * Set up the StableSave Vault for testing on devnet (or a local validator)
 * with a test token.
 *
 *   # 1. Program keypair, derived from your deployer key: same key → same program id every run
 *   pnpm --filter @stablesave/client devnet keys --out ../../target/deploy
 *
 *   # 2. Build with that program id and deploy (see docs/devnet-testing.md), then:
 *   pnpm --filter @stablesave/client devnet setup --rpc https://api.devnet.solana.com \
 *     --program <program id> --to <your wallet> [--amount 10000] [--mint <existing 6-decimal mint>]
 *
 * `setup` creates a 6-decimal test token ("test USD", mint authority = the
 * deployer) unless --mint is given, sends --amount of it to --to, opens the
 * three vaults (safe / balanced / bigger) for that token, opens a practice pool
 * for each protocol in each vault's strategy, and funds each vault's yield
 * sponsor with test tokens. Safe to re-run.
 *
 *   # Local rehearsal only: deposit and withdraw from a throwaway wallet
 *   pnpm --filter @stablesave/client devnet smoke --rpc http://127.0.0.1:8899 --program <id> --mint <mint>
 *
 * The deployer key is read from STABLESAVE_DEPLOYER_KEY (a solana-keygen JSON
 * array, or a base58 private key as exported by Phantom / Solflare) or from
 * --keypair <path>. It pays for everything and becomes the vault authority.
 * Devnet only: never use a key that holds real funds.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  address,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  lamports,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import { getCreateAccountInstruction, getTransferSolInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMaybeMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
} from "@solana-program/token";
import {
  buildDepositInstruction,
  buildSyncPoolsInstructions,
  buildWithdrawPlan,
  deriveVaultAddresses,
  fetchMaybePracticePool,
  fetchMaybeUserPosition,
  fetchPracticePools,
  fetchVault,
  findPracticePoolPda,
  findYieldSponsorPda,
  getOpenPracticePoolInstructionAsync,
  poolLiquidity,
  summarizePosition,
  fromBaseUnits,
  toBaseUnits,
} from "../src/index";
import { initializeVaults } from "./initialize-vaults";
import { connect, deriveKeypair, keypairBytes, sendInstructions, type Connection } from "./lib";

const DECIMALS = 6;

/**
 * Fixed practice rates by protocol index (basis points a year): Kamino 5.20%,
 * MarginFi 5.90%, Drift 6.80%, Save 5.05%. Practice figures, not market rates.
 */
const PRACTICE_APY_BPS: Record<number, number> = { 0: 520, 1: 590, 2: 680, 3: 505 };
/** Test tokens kept in each vault's yield sponsor to pay practice interest. */
const SPONSOR_TARGET = 5_000;

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name: string): string {
  const value = flag(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function deployerSecret(): Uint8Array {
  const path = flag("keypair");
  const text = path ? readFileSync(path, "utf8") : process.env.STABLESAVE_DEPLOYER_KEY;
  if (!text) throw new Error("Set STABLESAVE_DEPLOYER_KEY or pass --keypair <path>.");
  return keypairBytes(text);
}

/** key=value lines for GitHub Actions step outputs; printed either way. */
function output(values: Record<string, string>) {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  console.log(lines.join("\n"));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

async function keys() {
  const secret = deployerSecret();
  const deployer = await createKeyPairSignerFromBytes(secret);
  const program = await deriveKeypair(secret, "program");
  const mint = await deriveKeypair(secret, "test-mint");
  const out = required("out");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "stablesave_vault-keypair.json"), JSON.stringify([...program.solanaCliBytes]), { mode: 0o600 });
  writeFileSync(join(out, "deployer-keypair.json"), JSON.stringify([...secret]), { mode: 0o600 });
  output({ program_id: program.signer.address, deployer: deployer.address, test_mint: mint.signer.address });
}

/** Create the deployer's test token if it doesn't exist yet. */
async function ensureTestMint(connection: Connection, deployer: KeyPairSigner, mintSigner: KeyPairSigner) {
  const existing = await fetchMaybeMint(connection.rpc, mintSigner.address);
  if (existing.exists) {
    console.log(`test token ${mintSigner.address} already exists`);
    return;
  }
  const space = BigInt(getMintSize());
  const rent = await connection.rpc.getMinimumBalanceForRentExemption(space).send();
  const signature = await sendInstructions(connection, deployer, [
    getCreateAccountInstruction({
      payer: deployer,
      newAccount: mintSigner,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({ mint: mintSigner.address, decimals: DECIMALS, mintAuthority: deployer.address }),
  ]);
  console.log(`created test token ${mintSigner.address} (${signature})`);
}

async function sendTestTokens(connection: Connection, deployer: KeyPairSigner, mint: Address, to: Address, amount: number) {
  const [ata] = await findAssociatedTokenPda({ owner: to, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const signature = await sendInstructions(connection, deployer, [
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: deployer, owner: to, mint }),
    getMintToInstruction({ mint, token: ata, mintAuthority: deployer, amount: toBaseUnits(amount, DECIMALS) }),
  ]);
  console.log(`sent ${amount} test tokens to ${to} (${signature})`);
  return ata;
}

async function setup() {
  const secret = deployerSecret();
  const deployer = await createKeyPairSignerFromBytes(secret);
  const connection = connect(flag("rpc") ?? "https://api.devnet.solana.com");
  const programAddress = address(required("program"));

  const balance = (await connection.rpc.getBalance(deployer.address).send()).value;
  console.log(`deployer ${deployer.address}: ${Number(balance) / 1e9} SOL`);

  let mint: Address;
  let canMint: boolean;
  const given = flag("mint");
  if (given) {
    mint = address(given);
    const account = await fetchMaybeMint(connection.rpc, mint);
    if (!account.exists) throw new Error(`Token ${mint} doesn't exist on this cluster.`);
    if (account.data.decimals !== DECIMALS) throw new Error(`The vault needs a ${DECIMALS}-decimal token; ${mint} has ${account.data.decimals}.`);
    const authority = account.data.mintAuthority;
    canMint = authority.__option === "Some" && authority.value === deployer.address;
  } else {
    const derived = await deriveKeypair(secret, "test-mint");
    await ensureTestMint(connection, deployer, derived.signer);
    mint = derived.signer.address;
    canMint = true;
  }

  const to = flag("to");
  if (to) {
    if (canMint) await sendTestTokens(connection, deployer, mint, address(to), Number(flag("amount") ?? "10000"));
    else console.log(`can't mint ${mint} (not the mint authority); get tokens from its faucet instead`);
  }

  const vaults = await initializeVaults({ connection, authority: deployer, mint, programAddress });
  await openPracticePools(connection, deployer, mint, programAddress, vaults, canMint);
  output({ program_id: programAddress, mint, vault_safe: vaults[0]!, vault_balanced: vaults[1]!, vault_bigger: vaults[2]! });
}

/**
 * Open a practice pool for every protocol in each vault's strategy, top up the
 * yield sponsor (when the deployer can mint the token), and rebalance once.
 */
async function openPracticePools(
  connection: Connection,
  deployer: KeyPairSigner,
  mint: Address,
  programAddress: Address,
  vaults: readonly Address[],
  canMint: boolean,
) {
  for (const vaultAddress of vaults) {
    const vault = (await fetchVault(connection.rpc, vaultAddress)).data;
    for (const allocation of vault.strategy.allocations) {
      const [pool] = await findPracticePoolPda({ vault: vaultAddress, protocol: allocation.protocol }, { programAddress });
      if ((await fetchMaybePracticePool(connection.rpc, pool)).exists) {
        console.log(`vault ${vaultAddress}: practice pool ${allocation.protocol} already open`);
        continue;
      }
      const apyBps = PRACTICE_APY_BPS[allocation.protocol] ?? 500;
      const ix = await getOpenPracticePoolInstructionAsync(
        { authority: deployer, vault: vaultAddress, pool, mint, protocol: allocation.protocol, apyBps },
        { programAddress },
      );
      console.log(`vault ${vaultAddress}: opened practice pool ${allocation.protocol} at ${apyBps / 100}% (${await sendInstructions(connection, deployer, [ix])})`);
    }

    const [sponsor] = await findYieldSponsorPda({ vault: vaultAddress }, { programAddress });
    const held = fromBaseUnits(BigInt((await connection.rpc.getTokenAccountBalance(sponsor).send()).value.amount));
    if (held < SPONSOR_TARGET / 2) {
      if (canMint) {
        const top = SPONSOR_TARGET - held;
        const sig = await sendInstructions(connection, deployer, [
          getMintToInstruction({ mint, token: sponsor, mintAuthority: deployer, amount: toBaseUnits(top, DECIMALS) }),
        ]);
        console.log(`vault ${vaultAddress}: added ${top} test tokens to the yield sponsor (${sig})`);
      } else {
        console.log(`vault ${vaultAddress}: yield sponsor ${sponsor} holds ${held}; send it tokens to pay practice interest`);
      }
    }

    const pools = await fetchPracticePools(connection.rpc, vaultAddress, { programAddress });
    const sync = await buildSyncPoolsInstructions({ vaultAddress, vault, pools, programAddress });
    if (sync.length > 0) console.log(`vault ${vaultAddress}: rebalanced (${await sendInstructions(connection, deployer, sync)})`);
  }
}

/**
 * Rehearsal: a throwaway wallet deposits 100, the vault splits it into its
 * practice pools, then a 40 withdrawal pulls part of it back from the pools.
 */
async function smoke() {
  const deployer = await createKeyPairSignerFromBytes(deployerSecret());
  const connection = connect(required("rpc"));
  const programAddress = address(required("program"));
  const mint = address(required("mint"));
  const owner = await generateKeyPairSigner();

  // The owner pays rent for its position account.
  await sendInstructions(connection, deployer, [
    getTransferSolInstruction({ source: deployer, destination: owner.address, amount: lamports(50_000_000n) }),
  ]);
  const ownerToken = await sendTestTokens(connection, deployer, mint, owner.address, 1_000);

  const ids = await deriveVaultAddresses({ mint, riskProfile: 1, owner: owner.address }, { programAddress });
  const reserveOf = async () => BigInt((await connection.rpc.getTokenAccountBalance(ids.reserve).send()).value.amount);

  let vault = (await fetchVault(connection.rpc, ids.vault)).data;
  const deposit = await buildDepositInstruction({
    vaultAddress: ids.vault,
    vault,
    reserveAmount: await reserveOf(),
    owner,
    ownerToken,
    amount: toBaseUnits(100),
    programAddress,
  });
  let pools = await fetchPracticePools(connection.rpc, ids.vault, { programAddress });
  if (pools.length === 0) throw new Error("The balanced vault has no practice pools; run setup first.");
  const sync = await buildSyncPoolsInstructions({ vaultAddress: ids.vault, vault, pools, programAddress });
  console.log(`deposit 100 and rebalance: ${await sendInstructions(connection, owner, [deposit, ...sync])}`);

  vault = (await fetchVault(connection.rpc, ids.vault)).data;
  pools = await fetchPracticePools(connection.rpc, ids.vault, { programAddress });
  const inPools = poolLiquidity(pools);
  const reserveNow = await reserveOf();
  if (inPools !== vault.deployedAssets) throw new Error(`Pools hold ${inPools} but the vault counts ${vault.deployedAssets}.`);
  if (inPools === 0n) throw new Error("Rebalance didn't move anything into the practice pools.");
  if (reserveNow * 10_000n < (reserveNow + inPools) * 1_999n) throw new Error("Rebalance dipped below the 20% liquidity buffer.");
  console.log(`split: ${fromBaseUnits(inPools)} in ${pools.length} practice pools, ${fromBaseUnits(reserveNow)} kept liquid ✓`);
  const position = await fetchMaybeUserPosition(connection.rpc, ids.position!);
  if (!position.exists || position.data.shares === 0n) throw new Error("Deposit didn't create a position with shares.");
  const summary = summarizePosition(vault, position.data, await reserveOf());
  console.log(`position: ${fromBaseUnits(summary.totalAssets)} in the vault`);

  const plan = await buildWithdrawPlan({
    vaultAddress: ids.vault,
    vault,
    position: position.data,
    reserveAmount: await reserveOf(),
    owner,
    ownerToken,
    amount: toBaseUnits(40),
    nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
    programAddress,
    pools,
  });
  if (plan.timelocked !== 0n) throw new Error("A 40 withdrawal shouldn't need the timelock.");
  console.log(`withdraw 40: ${await sendInstructions(connection, owner, plan.instructions)}`);

  const wallet = fromBaseUnits((await fetchToken(connection.rpc, ownerToken)).data.amount);
  if (Math.abs(wallet - 940) > 0.000_01) throw new Error(`Expected 940 in the wallet after deposit and withdrawal, got ${wallet}.`);
  console.log(`wallet balance after deposit and withdrawal: ${wallet} ✓`);

  const after = (await fetchVault(connection.rpc, ids.vault)).data;
  const poolsAfter = poolLiquidity(await fetchPracticePools(connection.rpc, ids.vault, { programAddress }));
  if (poolsAfter !== after.deployedAssets) throw new Error(`After the withdrawal, pools hold ${poolsAfter} but the vault counts ${after.deployedAssets}.`);
  console.log(`pools after withdrawal: ${fromBaseUnits(poolsAfter)} (accounting matches) ✓`);
}

const commands: Record<string, () => Promise<void>> = { keys, setup, smoke };
const command = process.argv[2] ?? "";
const run = commands[command];
if (!run) {
  console.error(`Usage: devnet <${Object.keys(commands).join(" | ")}> [options]. See the comment at the top of this file.`);
  process.exit(1);
}
run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

