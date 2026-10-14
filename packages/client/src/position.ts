import type { UserPosition, Vault } from "./generated";
import { assetsForShares } from "./math";

/** Mirrors `Vault::total_assets` on-chain. */
export function vaultTotalAssets(vault: Pick<Vault, "deployedAssets">, reserveAmount: bigint): bigint {
  return reserveAmount + vault.deployedAssets;
}

export interface PositionSummary {
  /** Value of active shares, in base units. */
  activeAssets: bigint;
  /** Value of shares locked in a pending request, in base units. */
  pendingAssets: bigint;
  totalAssets: bigint;
  /** totalAssets + withdrawn − deposited. Negative after a loss. */
  earned: bigint;
}

export function summarizePosition(vault: Vault, position: UserPosition, reserveAmount: bigint): PositionSummary {
  const total = vaultTotalAssets(vault, reserveAmount);
  const activeAssets = assetsForShares(position.shares, total, vault.totalShares);
  const pendingAssets = assetsForShares(position.pendingShares, total, vault.totalShares);
  const totalAssets = activeAssets + pendingAssets;
  return {
    activeAssets,
    pendingAssets,
    totalAssets,
    earned: totalAssets + position.totalWithdrawn - position.totalDeposited,
  };
}

export interface InstantAllowance {
  /** Most this position can withdraw right now without a timelock (base units). */
  available: bigint;
  limitedBy: "position" | "vault" | "liquidity" | "balance";
}

/**
 * How much can be withdrawn instantly, mirroring the checks in `withdraw`.
 * `nowSeconds` should come from the cluster clock when precision matters.
 */
export function instantWithdrawalAllowance(
  vault: Vault,
  position: UserPosition,
  reserveAmount: bigint,
  nowSeconds: bigint,
  /** Assets in practice pools passed to the withdrawal, which it can pull from. */
  poolLiquidity = 0n,
): InstantAllowance {
  const window = vault.limits.windowSeconds;
  // Mirrors `roll_window` in the program.
  const userUsed = nowSeconds >= position.windowStartTs + window ? 0n : position.windowWithdrawn;
  const vaultUsed = nowSeconds >= vault.windowStartTs + window ? 0n : vault.windowOutflow;

  const total = vaultTotalAssets(vault, reserveAmount);
  const candidates: Array<[bigint, InstantAllowance["limitedBy"]]> = [
    [clamp(vault.limits.largeWithdrawalThreshold - userUsed), "position"],
    [clamp(vault.limits.vaultInstantOutflowCap - vaultUsed), "vault"],
    [reserveAmount + poolLiquidity, "liquidity"],
    [assetsForShares(position.shares, total, vault.totalShares), "balance"],
  ];
  const [available, limitedBy] = candidates.reduce((min, c) => (c[0] < min[0] ? c : min));
  return { available, limitedBy };
}

function clamp(value: bigint): bigint {
  return value < 0n ? 0n : value;
}
