import type { BestRate, MarketSummary, RatedOpportunity, StableAsset } from "./types";
import { STABLE_ASSETS } from "./types";

/** Headline numbers for the market summary strip. */
export function summarizeMarket(opportunities: readonly RatedOpportunity[]): MarketSummary {
  const bestGradeA: Partial<Record<StableAsset, BestRate>> = {};
  for (const asset of STABLE_ASSETS) {
    const best = opportunities
      .filter((o) => o.asset === asset && o.safety.grade === "A")
      .sort((a, b) => b.yield.totalApy - a.yield.totalApy)[0];
    if (best) bestGradeA[asset] = { opportunityId: best.id, protocolName: best.protocolName, apy: best.yield.totalApy };
  }
  return {
    optionCount: opportunities.length,
    protocolCount: new Set(opportunities.map((o) => o.protocolId)).size,
    bestGradeA,
  };
}
