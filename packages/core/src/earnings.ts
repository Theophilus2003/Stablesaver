import type { FeeSchedule } from "./types";

export interface EarningsEstimate {
  principal: number;
  /** APY used for the estimate (decimal). */
  apy: number;
  years: number;
  /** Yield on the amount actually invested, before one-off fees. */
  grossYield: number;
  depositFee: number;
  withdrawalFee: number;
  networkFees: number;
  totalFees: number;
  /** grossYield − totalFees. Can be negative for tiny amounts. */
  netEarnings: number;
  /** netEarnings / principal / years. */
  effectiveApy: number;
}

const ZERO_FEES: FeeSchedule = {
  depositFeeBps: 0,
  withdrawalFeeBps: 0,
  performanceFeeBps: 0,
  estimatedNetworkFeeUsd: 0,
  refundableRentUsd: 0,
};

/**
 * Estimated earnings = amount × estimated yield − applicable fees.
 *
 * - The APY already compounds, so one year of yield is `invested × apy`.
 *   Longer horizons compound annually: `invested × ((1 + apy)^years − 1)`.
 * - Deposit fees reduce the amount that earns yield.
 * - Withdrawal fees apply to everything withdrawn (principal + yield).
 * - Network fees are a flat estimate for depositing and withdrawing once.
 * - Refundable account rent is not a cost and is excluded.
 *
 * This is an estimate. Rates move, and returns are not guaranteed.
 */
export function estimateEarnings(
  principal: number,
  apy: number,
  fees: FeeSchedule = ZERO_FEES,
  options: { years?: number } = {},
): EarningsEstimate {
  const years = options.years ?? 1;
  const safePrincipal = Number.isFinite(principal) && principal > 0 ? principal : 0;
  const safeApy = Number.isFinite(apy) ? apy : 0;

  if (safePrincipal === 0) {
    return {
      principal: 0,
      apy: safeApy,
      years,
      grossYield: 0,
      depositFee: 0,
      withdrawalFee: 0,
      networkFees: 0,
      totalFees: 0,
      netEarnings: 0,
      effectiveApy: 0,
    };
  }

  const depositFee = safePrincipal * bps(fees.depositFeeBps);
  const invested = safePrincipal - depositFee;
  const growth = years === 1 ? safeApy : Math.pow(1 + safeApy, years) - 1;
  const grossYield = invested * growth;
  const withdrawalFee = (invested + grossYield) * bps(fees.withdrawalFeeBps);
  const networkFees = Math.max(0, fees.estimatedNetworkFeeUsd);
  const totalFees = depositFee + withdrawalFee + networkFees;
  const netEarnings = grossYield - totalFees;

  return {
    principal: safePrincipal,
    apy: safeApy,
    years,
    grossYield,
    depositFee,
    withdrawalFee,
    networkFees,
    totalFees,
    netEarnings,
    effectiveApy: netEarnings / safePrincipal / years,
  };
}

function bps(value: number): number {
  return Math.max(0, value) / 10_000;
}
