import { estimateEarnings, type EarningsEstimate } from "./earnings";
import { meetsGrade } from "./grades";
import { RISK_PROFILES, type RiskProfile } from "./profiles";
import type { RatedOpportunity, StableAsset } from "./types";

export type IneligibleReason = "grade" | "liquidity" | "fees";

export interface RankedOption {
  opportunity: RatedOpportunity;
  estimate: EarningsEstimate;
  /** 0..1 — how well this option fits the chosen risk profile. */
  fitScore: number;
  eligible: boolean;
  ineligibleReason?: IneligibleReason;
}

export interface Recommendation {
  profile: RiskProfile;
  asset: StableAsset;
  amount: number;
  best: RankedOption | null;
  /**
   * When nothing meets the risk setting's minimum grade: the safest option
   * that otherwise works for this amount, so the user can see how close the
   * market gets. Always shown as "below your setting", never as a fit.
   */
  closest: RankedOption | null;
  /** Every option for the asset, best fit first. Ineligible options sort last. */
  ranked: RankedOption[];
}

export interface RecommendInput {
  amount: number;
  asset: StableAsset;
  profile: RiskProfile;
  opportunities: readonly RatedOpportunity[];
}

/**
 * Rank options for a deposit. Pure and synchronous so the calculator can
 * re-run it on every keystroke.
 *
 * fit = safetyWeight × (safety score / 100) + yieldWeight × (kept yield / best eligible kept yield)
 *
 * "Kept yield" is the effective APY after fees, so a high rate on a network
 * with expensive transactions doesn't win for small amounts.
 */
export function recommend({ amount, asset, profile, opportunities }: RecommendInput): Recommendation {
  const config = RISK_PROFILES[profile];
  const forAsset = opportunities.filter((o) => o.asset === asset);

  const evaluated = forAsset.map((opportunity) => {
    const estimate = estimateEarnings(amount, opportunity.yield.totalApy, opportunity.fees);
    let ineligibleReason: IneligibleReason | undefined;
    if (!meetsGrade(opportunity.safety.grade, config.minGrade)) ineligibleReason = "grade";
    else if (amount > 0 && amount > opportunity.liquidityUsd * config.maxShareOfLiquidity) ineligibleReason = "liquidity";
    else if (amount > 0 && estimate.netEarnings <= 0) ineligibleReason = "fees";
    return { opportunity, estimate, ineligibleReason };
  });

  const keptYield = (e: { opportunity: RatedOpportunity; estimate: EarningsEstimate }) =>
    amount > 0 ? Math.max(0, e.estimate.effectiveApy) : e.opportunity.yield.totalApy;
  const maxKept = Math.max(0.0001, ...evaluated.filter((e) => !e.ineligibleReason).map(keptYield));

  const ranked: RankedOption[] = evaluated
    .map(({ opportunity, estimate, ineligibleReason }) => {
      const safety = opportunity.safety.score / 100;
      const yieldRatio = Math.min(1, keptYield({ opportunity, estimate }) / maxKept);
      const fitScore = config.safetyWeight * safety + config.yieldWeight * yieldRatio;
      return {
        opportunity,
        estimate,
        fitScore,
        eligible: !ineligibleReason,
        ...(ineligibleReason ? { ineligibleReason } : {}),
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.fitScore - a.fitScore || b.estimate.netEarnings - a.estimate.netEarnings;
    });

  const best = ranked.find((r) => r.eligible) ?? null;
  const closest = best
    ? null
    : ([...ranked]
        .filter((r) => r.ineligibleReason === "grade")
        .filter((r) => amount <= 0 || (amount <= r.opportunity.liquidityUsd * config.maxShareOfLiquidity && r.estimate.netEarnings > 0))
        .sort(
          (a, b) =>
            b.opportunity.safety.score - a.opportunity.safety.score || b.estimate.netEarnings - a.estimate.netEarnings,
        )[0] ?? null);
  return { profile, asset, amount, best, closest, ranked };
}

export type SortMode = "best" | "rate" | "safest" | "popular";

export function sortOptions(options: readonly RankedOption[], mode: SortMode): RankedOption[] {
  const list = [...options];
  switch (mode) {
    case "best":
      return list; // already ranked by fit
    case "rate":
      return list.sort((a, b) => b.opportunity.yield.totalApy - a.opportunity.yield.totalApy);
    case "safest":
      return list.sort(
        (a, b) => b.opportunity.safety.score - a.opportunity.safety.score || b.opportunity.yield.totalApy - a.opportunity.yield.totalApy,
      );
    case "popular": {
      // Depositor counts when every option has one; otherwise deposits (TVL) as the proxy.
      const byDepositors = list.every((o) => o.opportunity.depositors !== null);
      return list.sort((a, b) =>
        byDepositors
          ? b.opportunity.depositors! - a.opportunity.depositors!
          : b.opportunity.tvlUsd - a.opportunity.tvlUsd,
      );
    }
  }
}

export const INELIGIBLE_COPY: Record<IneligibleReason, string> = {
  grade: "Riskier than your setting",
  liquidity: "Your amount is large for its liquidity",
  fees: "Fees cost more than you'd earn",
};
