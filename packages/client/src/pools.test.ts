import { AccountRole, address, type Address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  ACCRUE_PRACTICE_YIELD_DISCRIMINATOR,
  REBALANCE_DISCRIMINATOR,
  STABLESAVE_VAULT_PROGRAM_ADDRESS,
  buildSyncPoolsInstructions,
  deriveVaultAddresses,
  findPracticePoolPda,
  findYieldSponsorPda,
  poolLiquidity,
  withPoolAccounts,
  type PracticePool,
  type PracticePoolRef,
  type Vault,
} from "./index";

const MINT = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function pools(): Promise<{ vaultAddress: Address; reserve: Address; refs: PracticePoolRef[] }> {
  const { vault: vaultAddress, reserve } = await deriveVaultAddresses({ mint: MINT, riskProfile: 1 });
  const refs = await Promise.all(
    (
      [
        [0, 3_000n],
        [1, 7_000n],
      ] as const
    ).map(async ([protocol, deployed]) => {
      const [pool] = await findPracticePoolPda({ vault: vaultAddress, protocol });
      const [tokens] = await findPracticePoolPda({ vault: vaultAddress, protocol: protocol + 10 });
      const data = { vault: vaultAddress, protocol, tokens, deployed } as unknown as PracticePool;
      return { address: pool, data };
    }),
  );
  return { vaultAddress, reserve, refs };
}

describe("practice pools", () => {
  it("derives one pool address per protocol", async () => {
    const { vault } = await deriveVaultAddresses({ mint: MINT, riskProfile: 1 });
    const [a] = await findPracticePoolPda({ vault, protocol: 0 });
    const [b] = await findPracticePoolPda({ vault, protocol: 1 });
    const [a2] = await findPracticePoolPda({ vault, protocol: 0 });
    expect(a).not.toBe(b);
    expect(a).toBe(a2);
  });

  it("sums pool liquidity", async () => {
    const { refs } = await pools();
    expect(poolLiquidity(refs)).toBe(10_000n);
    expect(poolLiquidity([])).toBe(0n);
  });

  it("adds pools as writable remaining accounts, fullest first", async () => {
    const { refs } = await pools();
    const ix = { programAddress: STABLESAVE_VAULT_PROGRAM_ADDRESS, accounts: [{ address: MINT, role: AccountRole.READONLY }] };
    const out = withPoolAccounts(ix, refs);
    expect(out.accounts).toHaveLength(5);
    // Protocol 1 holds more, so it comes first.
    expect(out.accounts[1]).toEqual({ address: refs[1]!.address, role: AccountRole.WRITABLE });
    expect(out.accounts[2]).toEqual({ address: refs[1]!.data.tokens, role: AccountRole.WRITABLE });
    expect(withPoolAccounts(ix, [])).toBe(ix);
  });

  it("accrues every pool, then rebalances every pool", async () => {
    const { vaultAddress, reserve, refs } = await pools();
    const vault = { mint: MINT, reserve } as unknown as Vault;
    const ixs = await buildSyncPoolsInstructions({ vaultAddress, vault, pools: refs });
    expect(ixs).toHaveLength(4);
    const [sponsor] = await findYieldSponsorPda({ vault: vaultAddress });
    expect(Array.from(ixs[0]!.data!.slice(0, 8))).toEqual(Array.from(ACCRUE_PRACTICE_YIELD_DISCRIMINATOR));
    expect(ixs[0]!.accounts!.map((a) => a.address)).toContain(sponsor);
    expect(Array.from(ixs[3]!.data!.slice(0, 8))).toEqual(Array.from(REBALANCE_DISCRIMINATOR));
    expect(ixs[3]!.accounts!.map((a) => a.address)).toContain(reserve);
    expect(await buildSyncPoolsInstructions({ vaultAddress, vault, pools: [] })).toEqual([]);
  });
});
