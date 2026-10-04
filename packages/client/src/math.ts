/**
 * Off-chain mirror of `programs/stablesave-vault/src/math.rs`.
 * Use it for previews; the program is the source of truth.
 */

export const VIRTUAL_SHARES = 1_000n;
export const VIRTUAL_ASSETS = 1n;
export const USDC_DECIMALS = 6;
const UNIT = 10n ** BigInt(USDC_DECIMALS);

export function sharesForDeposit(assets: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  return (assets * (totalShares + VIRTUAL_SHARES)) / (totalAssets + VIRTUAL_ASSETS);
}

export function assetsForShares(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  return (shares * (totalAssets + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES);
}

/**
 * Shares to redeem so the payout is at least `assets` (rounds up), capped at
 * `maxShares`.
 */
export function sharesForAssets(assets: bigint, totalAssets: bigint, totalShares: bigint, maxShares?: bigint): bigint {
  const numerator = assets * (totalShares + VIRTUAL_SHARES);
  const denominator = totalAssets + VIRTUAL_ASSETS;
  const shares = (numerator + denominator - 1n) / denominator;
  return maxShares !== undefined && shares > maxShares ? maxShares : shares;
}

/** 12.5 → 12_500_000n */
export function toBaseUnits(amount: number, decimals = USDC_DECIMALS): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const [whole = "0", fraction = ""] = amount.toFixed(decimals).split(".");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0").slice(0, decimals) || "0");
}

/** 12_500_000n → 12.5 */
export function fromBaseUnits(amount: bigint, decimals = USDC_DECIMALS): number {
  const unit = decimals === USDC_DECIMALS ? UNIT : 10n ** BigInt(decimals);
  return Number(amount / unit) + Number(amount % unit) / Number(unit);
}

/** Apply slippage tolerance to an expected amount (rounds down). */
export function withSlippage(expected: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (expected * (10_000n - bps)) / 10_000n;
}
