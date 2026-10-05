import type { BestRate, Grade, MarketSummary, RatedOpportunity, StableAsset } from "./types";
import { STABLE_ASSETS } from "./types";

const GRADE_ORDER: readonly Grade[] = ["A", "B", "C", "D"];

/** Headline numbers for the market summary strip. */
export function summarizeMarket(opportunities: readonly RatedOpportunity[]): MarketSummary {
  const bestTopGrade: Partial<Record<StableAsset, BestRate>> = {};
  for (const asset of STABLE_ASSETS) {
    const forAsset = opportunities.filter((o) => o.asset === asset);
    const grade = GRADE_ORDER.find((g) => forAsset.some((o) => o.safety.grade === g));
    if (!grade) continue;
    const best = forAsset
      .filter((o) => o.safety.grade === grade)
      .sort((a, b) => b.yield.totalApy - a.yield.totalApy)[0]!;
    bestTopGrade[asset] = {
      opportunityId: best.id,
      protocolName: best.protocolName,
      networkName: best.networkName,
      apy: best.yield.totalApy,
      grade,
    };
  }
  return {
    optionCount: opportunities.length,
    protocolCount: new Set(opportunities.map((o) => o.protocolId)).size,
    networkCount: new Set(opportunities.map((o) => o.network)).size,
    bestTopGrade,
  };
}
