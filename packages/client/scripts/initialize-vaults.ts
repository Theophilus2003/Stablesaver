/**
 * Initialize the three StableSave vaults (safe / balanced / bigger) for a mint.
 *
 *   pnpm --filter @stablesave/client init-vaults -- \
 *     --rpc https://api.devnet.solana.com \
 *     --mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *     --keypair ~/.config/solana/id.json \
 *     [--guardian <pubkey>] [--program <program id>]
 *
 * The keypair must be the program's upgrade authority (the program enforces it).
 * Allocations below are the same EXAMPLE weights the UI shows — replace them
 * with your own strategy before using real funds.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
} from "@solana/kit";
import {
  STABLESAVE_VAULT_PROGRAM_ADDRESS,
  Protocol,
  fetchMaybeVault,
  findVaultPda,
  getInitializeVaultInstructionAsync,
  type RiskProfileId,
} from "../src/index";

const BPF_LOADER_UPGRADEABLE = address("BPFLoaderUpgradeab1e11111111111111111111111");
const USDC = 1_000_000n;

const EXAMPLE_ALLOCATIONS: Record<RiskProfileId, Array<{ protocol: Protocol; weightBps: number }>> = {
  0: [
    { protocol: Protocol.Kamino, weightBps: 6_000 },
    { protocol: Protocol.Save, weightBps: 4_000 },
  ],
  1: [
    { protocol: Protocol.Kamino, weightBps: 4_500 },
    { protocol: Protocol.Marginfi, weightBps: 3_000 },
    { protocol: Protocol.Save, weightBps: 2_500 },
  ],
  2: [
    { protocol: Protocol.Kamino, weightBps: 3_000 },
    { protocol: Protocol.Marginfi, weightBps: 3_000 },
    { protocol: Protocol.Drift, weightBps: 2_500 },
    { protocol: Protocol.Save, weightBps: 1_500 },
  ],
};

const LIMITS = {
  depositCap: 1_000_000n * USDC,
  minDeposit: 1n * USDC,
  largeWithdrawalThreshold: 2_000n * USDC,
  withdrawalTimelockSeconds: 30n * 60n,
  windowSeconds: 24n * 60n * 60n,
  vaultInstantOutflowCap: 50_000n * USDC,
};

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : fallback;
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function wsUrl(rpc: string): string {
  return rpc.replace(/^http/, "ws");
}

async function main() {
  const rpcUrl = arg("rpc", "https://api.devnet.solana.com");
  const mint = address(arg("mint"));
  const programAddress = address(arg("program", STABLESAVE_VAULT_PROGRAM_ADDRESS));
  const keypairPath = arg("keypair", `${homedir()}/.config/solana/id.json`).replace(/^~/, homedir());
  const authority = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(keypairPath, "utf8"))));
  const guardian = address(arg("guardian", authority.address));

  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl(rpcUrl));
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

  const [programData] = await getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE,
    seeds: [getAddressEncoder().encode(programAddress)],
  });

  for (const riskProfile of [0, 1, 2] as RiskProfileId[]) {
    const [vault] = await findVaultPda({ mint, riskProfile }, { programAddress });
    if ((await fetchMaybeVault(rpc, vault)).exists) {
      console.log(`profile ${riskProfile}: vault ${vault} already exists, skipping`);
      continue;
    }
    const ix = await getInitializeVaultInstructionAsync(
      {
        authority,
        mint,
        vault,
        programData: programData as Address,
        program: programAddress,
        riskProfile,
        guardian,
        limits: LIMITS,
        allocations: EXAMPLE_ALLOCATIONS[riskProfile],
      },
      { programAddress },
    );
    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(authority, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(ix, m),
    );
    const signed = await signTransactionMessageWithSigners(message);
    await sendAndConfirm(signed as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
    console.log(`profile ${riskProfile}: initialized ${vault} (${getSignatureFromTransaction(signed)})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
