import {
  AccountRole,
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Address,
  type GetMultipleAccountsApi,
  type Instruction,
  type ProgramDerivedAddress,
  type Rpc,
} from "@solana/kit";
import {
  STABLESAVE_VAULT_PROGRAM_ADDRESS,
  fetchAllMaybePracticePool,
  findYieldSponsorPda,
  getAccruePracticeYieldInstructionAsync,
  getRebalanceInstruction,
  type PracticePool,
  type Vault,
} from "./generated";

/**
 * Practice pools: where the vault puts deposits, one per protocol, until CPI
 * into the real protocols ships. `rebalance` and `accrue_practice_yield` are
 * permissionless, so any client can keep a vault in line with its strategy.
 */

export interface PracticePoolRef {
  address: Address;
  data: PracticePool;
}

/** Protocol indexes the program can open pools for (Kamino, MarginFi, Drift, Save). */
export const PRACTICE_PROTOCOL_INDEXES = [0, 1, 2, 3] as const;

/** PDA: ["pool", vault, protocol index] */
export async function findPracticePoolPda(
  seeds: { vault: Address; protocol: number },
  config: { programAddress?: Address } = {},
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: config.programAddress ?? STABLESAVE_VAULT_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("pool"), getAddressEncoder().encode(seeds.vault), new Uint8Array([seeds.protocol])],
  });
}

/** Every practice pool the vault has opened. Empty for a vault without pools. */
export async function fetchPracticePools(
  rpc: Rpc<GetMultipleAccountsApi>,
  vaultAddress: Address,
  config: { programAddress?: Address } = {},
): Promise<PracticePoolRef[]> {
  const addresses = await Promise.all(
    PRACTICE_PROTOCOL_INDEXES.map(async (protocol) => (await findPracticePoolPda({ vault: vaultAddress, protocol }, config))[0]),
  );
  const accounts = await fetchAllMaybePracticePool(rpc, addresses);
  return accounts.flatMap((a) => (a.exists ? [{ address: a.address, data: a.data }] : []));
}

/** Assets held in the pools (base units). */
export function poolLiquidity(pools: readonly PracticePoolRef[]): bigint {
  return pools.reduce((sum, p) => sum + p.data.deployed, 0n);
}

/**
 * Pay every pool its interest, then move each toward its strategy weight.
 * Safe to append to any transaction: each step is a no-op when nothing is due.
 */
export async function buildSyncPoolsInstructions(params: {
  vaultAddress: Address;
  vault: Vault;
  pools: readonly PracticePoolRef[];
  programAddress?: Address;
}): Promise<Instruction[]> {
  const { vaultAddress, vault, pools } = params;
  if (pools.length === 0) return [];
  const config = params.programAddress ? { programAddress: params.programAddress } : undefined;
  const [yieldSponsor] = await findYieldSponsorPda({ vault: vaultAddress }, config);
  const accrue = await Promise.all(
    pools.map((p) =>
      getAccruePracticeYieldInstructionAsync(
        { vault: vaultAddress, pool: p.address, tokens: p.data.tokens, yieldSponsor, mint: vault.mint },
        config,
      ),
    ),
  );
  const rebalance = pools.map((p) =>
    getRebalanceInstruction({ vault: vaultAddress, pool: p.address, tokens: p.data.tokens, reserve: vault.reserve, mint: vault.mint }, config),
  );
  return [...accrue, ...rebalance];
}

/**
 * Adds the pools as remaining accounts to `withdraw` / `execute_withdrawal`, so
 * the program can pull any shortfall from them. Fullest pools first.
 */
export function withPoolAccounts<T extends Instruction>(instruction: T, pools: readonly PracticePoolRef[]): T {
  if (pools.length === 0) return instruction;
  const ordered = [...pools].sort((a, b) => (b.data.deployed > a.data.deployed ? 1 : b.data.deployed < a.data.deployed ? -1 : 0));
  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      ...ordered.flatMap((p) => [
        { address: p.address, role: AccountRole.WRITABLE },
        { address: p.data.tokens, role: AccountRole.WRITABLE },
      ]),
    ],
  };
}
