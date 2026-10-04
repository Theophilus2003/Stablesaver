import { estimateEarnings, type EarningsEstimate } from "./earnings";
import { gradeFromScore } from "./grades";
import { RISK_PROFILE_IDS, type RiskProfile } from "./profiles";
import type { FeeSchedule, Grade, GradeModifier, ProtocolId, RatedOpportunity } from "./types";

/**
 * StableSave Vault strategy configuration.
 *
 * A strategy is a set of target weights across Solana protocols for one risk
 * profile. The on-chain program stores the same shape (protocol id + weight in
 * basis points) in each vault account; this module is the off-chain mirror used
 * for previews before a vault is deployed and for blending estimates.
 */

export const MAX_ALLOCATIONS = 8;
export const BPS = 10_000;

/** Matches `ProtocolId` in the Anchor program (`state::Protocol`). */
export const ONCHAIN_PROTOCOL_IDS: Record<ProtocolId, number> = {
  kamino: 0,
  marginfi: 1,
  drift: 2,
  save: 3,
};

export function protocolFromOnchainId(id: number): ProtocolId | undefined {
  return (Object.keys(ONCHAIN_PROTOCOL_IDS) as ProtocolId[]).find((p) => ONCHAIN_PROTOCOL_IDS[p] === id);
}

export interface StrategyAllocation {
  protocolId: ProtocolId;
  /** The market this leg deploys into. */
  opportunityId: string;
  weightBps: number;
}

export type StrategySource =
  /** Illustrative weights for development. Not a recommendation. */
  | "example"
  /** Read from a deployed vault account. */
  | "onchain";

export interface VaultStrategy {
  profile: RiskProfile;
  name: string;
  version: number;
  source: StrategySource;
  allocations: StrategyAllocation[];
  /** Annual fee charged by the StableSave vault on assets. */
  managementFeeBps: number;
  /**
   * Points subtracted from the blended safety score for the vault's own
   * smart-contract layer. The vault is new code; that is extra risk.
   */
  vaultLayerRiskPoints: number;
}

export const EXAMPLE_STRATEGY_NOTE =
  "Example allocation for development and testing. These weights are not a financial recommendation.";

/**
 * Example allocations only. Replace with on-chain configuration once a vault is
 * deployed; the UI labels these as examples.
 */
export const EXAMPLE_VAULT_STRATEGIES: Record<RiskProfile, VaultStrategy> = {
  safe: {
    profile: "safe",
    name: "Play it safe",
    version: 1,
    source: "example",
    managementFeeBps: 0,
    vaultLayerRiskPoints: 4,
    allocations: [
      { protocolId: "kamino", opportunityId: "kamino-main-usdc", weightBps: 6_000 },
      { protocolId: "save", opportunityId: "save-main-usdc", weightBps: 4_000 },
    ],
  },
  balanced: {
    profile: "balanced",
    name: "Balanced",
    version: 1,
    source: "example",
    managementFeeBps: 0,
    vaultLayerRiskPoints: 4,
    allocations: [
      { protocolId: "kamino", opportunityId: "kamino-main-usdc", weightBps: 4_500 },
      { protocolId: "marginfi", opportunityId: "marginfi-global-usdc", weightBps: 3_000 },
      { protocolId: "save", opportunityId: "save-main-usdc", weightBps: 2_500 },
    ],
  },
  bigger: {
    profile: "bigger",
    name: "Go bigger",
    version: 1,
    source: "example",
    managementFeeBps: 0,
    vaultLayerRiskPoints: 4,
    allocations: [
      { protocolId: "kamino", opportunityId: "kamino-main-usdc", weightBps: 3_000 },
      { protocolId: "marginfi", opportunityId: "marginfi-global-usdc", weightBps: 3_000 },
      { protocolId: "drift", opportunityId: "drift-spot-usdc", weightBps: 2_500 },
      { protocolId: "save", opportunityId: "save-main-usdc", weightBps: 1_500 },
    ],
  },
};

/** Mirrors the on-chain checks in `update_strategy`. Returns human-readable problems. */
export function validateStrategy(strategy: Pick<VaultStrategy, "allocations">): string[] {
  const errors: string[] = [];
  const { allocations } = strategy;
  if (allocations.length === 0) errors.push("A strategy needs at least one allocation.");
  if (allocations.length > MAX_ALLOCATIONS) errors.push(`A strategy can have at most ${MAX_ALLOCATIONS} allocations.`);
  const seen = new Set<ProtocolId>();
  let total = 0;
  for (const a of allocations) {
    if (!Number.isInteger(a.weightBps) || a.weightBps <= 0) errors.push(`${a.protocolId}: weight must be a positive whole number of basis points.`);
    if (seen.has(a.protocolId)) errors.push(`${a.protocolId} appears more than once.`);
    seen.add(a.protocolId);
    total += a.weightBps;
  }
  if (total !== BPS) errors.push(`Weights must add up to 100% (got ${(total / 100).toFixed(2)}%).`);
  return errors;
}

export interface StrategyLeg {
  allocation: StrategyAllocation;
  opportunity: RatedOpportunity;
  amount: number;
}

/**
 * The market a strategy leg deploys into: the exact market when it exists,
 * otherwise that protocol's largest Solana USDC lending market. Live sources
 * name markets differently from the example ids, and the on-chain strategy
 * only stores protocols.
 */
export function resolveAllocation(
  allocation: Pick<StrategyAllocation, "protocolId" | "opportunityId">,
  opportunities: readonly RatedOpportunity[],
): RatedOpportunity | undefined {
  const exact = opportunities.find((o) => o.id === allocation.opportunityId);
  if (exact) return exact;
  return opportunities
    .filter(
      (o) =>
        o.protocolId === allocation.protocolId &&
        o.asset === "USDC" &&
        o.network === "solana" &&
        o.strategyType === "lending",
    )
    .sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
}

export interface BlendedStrategy {
  strategy: VaultStrategy;
  legs: StrategyLeg[];
  /** Allocations whose market isn't in the current dataset. */
  missing: StrategyAllocation[];
  /** Weighted APY after the vault management fee. */
  apy: number;
  estimate: EarningsEstimate;
  safety: { score: number; grade: Grade; modifier: GradeModifier; display: string; label: string };
}

/**
 * Blend a strategy against current market data.
 *
 * Safety: a split is only as strong as its weakest part, so the blended score
 * leans towards the riskiest leg (70% weighted average, 30% weakest leg), then
 * subtracts the vault's own contract risk.
 */
export function blendStrategy(
  strategy: VaultStrategy,
  opportunities: readonly RatedOpportunity[],
  amount: number,
): BlendedStrategy | null {
  const legs: StrategyLeg[] = [];
  const missing: StrategyAllocation[] = [];
  for (const allocation of strategy.allocations) {
    const opportunity = resolveAllocation(allocation, opportunities);
    if (opportunity) legs.push({ allocation, opportunity, amount: (amount * allocation.weightBps) / BPS });
    else missing.push(allocation);
  }
  if (legs.length === 0) return null;

  const coveredBps = legs.reduce((sum, l) => sum + l.allocation.weightBps, 0);
  const weight = (l: StrategyLeg) => l.allocation.weightBps / coveredBps;

  const grossApy = legs.reduce((sum, l) => sum + weight(l) * l.opportunity.yield.totalApy, 0);
  const apy = Math.max(0, grossApy - strategy.managementFeeBps / BPS);

  // One vault deposit + withdrawal; the vault handles the per-protocol moves.
  const fees: FeeSchedule = {
    depositFeeBps: 0,
    withdrawalFeeBps: 0,
    performanceFeeBps: 0,
    estimatedNetworkFeeUsd: 0.02,
    refundableRentUsd: 0.3,
  };
  const estimate = estimateEarnings(amount, apy, fees);

  const avgScore = legs.reduce((sum, l) => sum + weight(l) * l.opportunity.safety.score, 0);
  const minScore = Math.min(...legs.map((l) => l.opportunity.safety.score));
  const score = Math.round(Math.max(0, 0.7 * avgScore + 0.3 * minScore - strategy.vaultLayerRiskPoints));

  return { strategy, legs, missing, apy, estimate, safety: { score, ...gradeFromScore(score) } };
}

export function allStrategies(source: Record<RiskProfile, VaultStrategy> = EXAMPLE_VAULT_STRATEGIES): VaultStrategy[] {
  return RISK_PROFILE_IDS.map((p) => source[p]);
}
