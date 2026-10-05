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
import { pathToFileURL } from "node:url";
import { address, getAddressEncoder, getProgramDerivedAddress, type Address, type KeyPairSigner } from "@solana/kit";
import {
  STABLESAVE_VAULT_PROGRAM_ADDRESS,
  Protocol,
  fetchMaybeVault,
  findVaultPda,
  getInitializeVaultInstructionAsync,
  type RiskProfileId,
} from "../src/index";
import { connect, loadKeypairSigner, sendInstructions, type Connection } from "./lib";

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

export interface InitializeVaultsOptions {
  connection: Connection;
  /** Must be the program's upgrade authority (the program enforces it). */
  authority: KeyPairSigner;
  mint: Address;
  programAddress: Address;
  guardian?: Address;
  log?: (line: string) => void;
}

/** Create any of the three vaults (safe / balanced / bigger) that don't exist yet. Returns their addresses. */
export async function initializeVaults({
  connection,
  authority,
  mint,
  programAddress,
  guardian = authority.address,
  log = console.log,
}: InitializeVaultsOptions): Promise<Address[]> {
  const [programData] = await getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE,
    seeds: [getAddressEncoder().encode(programAddress)],
  });

  const vaults: Address[] = [];
  for (const riskProfile of [0, 1, 2] as RiskProfileId[]) {
    const [vault] = await findVaultPda({ mint, riskProfile }, { programAddress });
    vaults.push(vault);
    if ((await fetchMaybeVault(connection.rpc, vault)).exists) {
      log(`profile ${riskProfile}: vault ${vault} already exists, skipping`);
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
    const signature = await sendInstructions(connection, authority, [ix]);
    log(`profile ${riskProfile}: initialized ${vault} (${signature})`);
  }
  return vaults;
}

async function main() {
  const connection = connect(arg("rpc", "https://api.devnet.solana.com"));
  const keypairPath = arg("keypair", `${homedir()}/.config/solana/id.json`).replace(/^~/, homedir());
  const authority = await loadKeypairSigner(readFileSync(keypairPath, "utf8"));
  await initializeVaults({
    connection,
    authority,
    mint: address(arg("mint")),
    programAddress: address(arg("program", STABLESAVE_VAULT_PROGRAM_ADDRESS)),
    guardian: address(arg("guardian", authority.address)),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
