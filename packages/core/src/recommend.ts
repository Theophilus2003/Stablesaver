import { estimateEarnings, type EarningsEstimate } from "./earnings";
import { meetsGrade } from "./grades";
import { RISK_PROFILES, type RiskProfile } from "./profiles";
import type { RatedOpportunity, StableAsset } from "./types";

export type IneligibleReason = "grade" | "liquidity" | "network";

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
 * fit = safetyWeight × (safety score / 100) + yieldWeight × (apy / best eligible apy)
 */
export function recommend({ amount, asset, profile, opportunities }: RecommendInput): Recommendation {
  const config = RISK_PROFILES[profile];
  const forAsset = opportunities.filter((o) => o.asset === asset);

  const evaluated = forAsset.map((opportunity) => {
    const estimate = estimateEarnings(amount, opportunity.yield.totalApy, opportunity.fees);
    let ineligibleReason: IneligibleReason | undefined;
    if (opportunity.network !== "solana") ineligibleReason = "network";
    else if (!meetsGrade(opportunity.safety.grade, config.minGrade)) ineligibleReason = "grade";
    else if (amount > 0 && amount > opportunity.liquidityUsd * config.maxShareOfLiquidity) ineligibleReason = "liquidity";
    return { opportunity, estimate, ineligibleReason };
  });

  const maxApy = Math.max(
    0.0001,
    ...evaluated.filter((e) => !e.ineligibleReason).map((e) => e.opportunity.yield.totalApy),
  );

  const ranked: RankedOption[] = evaluated
    .map(({ opportunity, estimate, ineligibleReason }) => {
      const safety = opportunity.safety.score / 100;
      const yieldRatio = Math.min(1, opportunity.yield.totalApy / maxApy);
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
      return b.fitScore - a.fitScore || b.opportunity.yield.totalApy - a.opportunity.yield.totalApy;
    });

  const best = ranked.find((r) => r.eligible) ?? null;
  return { profile, asset, amount, best, ranked };
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
    case "popular":
      return list.sort((a, b) => b.opportunity.depositors - a.opportunity.depositors);
  }
}

export const INELIGIBLE_COPY: Record<IneligibleReason, string> = {
  grade: "Riskier than your setting",
  liquidity: "Your amount is large for its liquidity",
  network: "Not supported yet",
};
