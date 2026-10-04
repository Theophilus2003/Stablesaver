import { AccountRole, address, type Address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  buildDepositInstruction,
  buildWithdrawPlan,
  DEPOSIT_DISCRIMINATOR,
  deriveVaultAddresses,
  findVaultPda,
  fromBaseUnits,
  getDepositInstructionDataDecoder,
  instantWithdrawalAllowance,
  Protocol,
  STABLESAVE_VAULT_PROGRAM_ADDRESS,
  sharesForDeposit,
  summarizePosition,
  toBaseUnits,
  type UserPosition,
  type Vault,
} from "./index";
import { toWeb3JsInstruction } from "./web3js";

const USDC = 1_000_000n;
const MINT = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const OWNER = address("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
const OWNER_TOKEN = address("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T");

async function fixture(): Promise<{ vaultAddress: Address; vault: Vault; position: UserPosition }> {
  const { vault: vaultAddress, reserve } = await deriveVaultAddresses({ mint: MINT, riskProfile: 1 });
  const totalShares = sharesForDeposit(10_000n * USDC, 0n, 0n);
  const vault: Vault = {
    discriminator: new Uint8Array(8),
    version: 1,
    bump: 255,
    reserveBump: 255,
    riskProfile: 1,
    paused: false,
    authority: OWNER,
    pendingAuthority: address("11111111111111111111111111111111"),
    guardian: OWNER,
    mint: MINT,
    reserve,
    totalShares,
    pendingWithdrawalShares: 0n,
    deployedAssets: 0n,
    cumulativeDeposits: 10_000n * USDC,
    cumulativeWithdrawals: 0n,
    limits: {
      depositCap: 1_000_000n * USDC,
      minDeposit: USDC,
      largeWithdrawalThreshold: 2_000n * USDC,
      withdrawalTimelockSeconds: 1_800n,
      windowSeconds: 86_400n,
      vaultInstantOutflowCap: 50_000n * USDC,
    },
    strategy: {
      version: 1,
      allocations: [
        { protocol: Protocol.Kamino, weightBps: 4_500 },
        { protocol: Protocol.Marginfi, weightBps: 3_000 },
        { protocol: Protocol.Save, weightBps: 2_500 },
      ],
    },
    windowStartTs: 0n,
    windowOutflow: 0n,
    createdAt: 0n,
    updatedAt: 0n,
  };
  const position: UserPosition = {
    discriminator: new Uint8Array(8),
    version: 1,
    bump: 255,
    vault: vaultAddress,
    owner: OWNER,
    shares: totalShares,
    pendingShares: 0n,
    pendingRequestedTs: 0n,
    pendingUnlockTs: 0n,
    totalDeposited: 10_000n * USDC,
    totalWithdrawn: 0n,
    windowStartTs: 0n,
    windowWithdrawn: 0n,
    createdAt: 0n,
    updatedAt: 0n,
  };
  return { vaultAddress, vault, position };
}

describe("units", () => {
  it("converts to and from base units", () => {
    expect(toBaseUnits(12.5)).toBe(12_500_000n);
    expect(toBaseUnits(0.000001)).toBe(1n);
    expect(toBaseUnits(-3)).toBe(0n);
    expect(fromBaseUnits(12_500_000n)).toBe(12.5);
  });
});

describe("pdas", () => {
  it("derives distinct vaults per risk profile", async () => {
    const [safe] = await findVaultPda({ mint: MINT, riskProfile: 0 });
    const [balanced] = await findVaultPda({ mint: MINT, riskProfile: 1 });
    expect(safe).not.toBe(balanced);
  });
});

describe("instructions", () => {
  it("builds a deposit with slippage protection", async () => {
    const { vaultAddress, vault } = await fixture();
    const ix = await buildDepositInstruction({
      vaultAddress,
      vault,
      reserveAmount: 10_000n * USDC,
      owner: OWNER,
      ownerToken: OWNER_TOKEN,
      amount: 1_000n * USDC,
      slippageBps: 50,
    });
    expect(ix.programAddress).toBe(STABLESAVE_VAULT_PROGRAM_ADDRESS);
    expect(Array.from(ix.data!.slice(0, 8))).toEqual(Array.from(DEPOSIT_DISCRIMINATOR));
    const data = getDepositInstructionDataDecoder().decode(ix.data!);
    expect(data.amount).toBe(1_000n * USDC);
    expect(data.minSharesOut).toBeGreaterThan(0n);
    expect(ix.accounts![0]).toMatchObject({ address: OWNER, role: AccountRole.WRITABLE_SIGNER });

    const legacy = toWeb3JsInstruction(ix);
    expect(legacy.programId.toBase58()).toBe(STABLESAVE_VAULT_PROGRAM_ADDRESS);
    expect(legacy.keys[0]).toMatchObject({ isSigner: true, isWritable: true });
  });

  it("splits a large withdrawal into instant + timelocked", async () => {
    const { vaultAddress, vault, position } = await fixture();
    const plan = await buildWithdrawPlan({
      vaultAddress,
      vault,
      position,
      reserveAmount: 10_000n * USDC,
      owner: OWNER,
      ownerToken: OWNER_TOKEN,
      amount: 5_000n * USDC,
      nowSeconds: 1_000_000n,
    });
    expect(plan.instant).toBe(2_000n * USDC);
    expect(plan.timelocked).toBe(3_000n * USDC);
    expect(plan.unlockAt).toBe(1_000_000n + 1_800n);
    expect(plan.instructions).toHaveLength(2);
  });

  it("reports allowance and earnings", async () => {
    const { vault, position } = await fixture();
    const allowance = instantWithdrawalAllowance(vault, position, 10_000n * USDC, 0n);
    expect(allowance).toEqual({ available: 2_000n * USDC, limitedBy: "position" });
    const summary = summarizePosition(vault, position, 10_500n * USDC);
    expect(summary.earned).toBeGreaterThan(499n * USDC);
  });
});
