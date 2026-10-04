import {
  EXAMPLE_VAULT_STRATEGIES,
  PROTOCOLS,
  blendStrategy,
  type BlendedStrategy,
  type ProtocolId,
  type RatedOpportunity,
  type RiskProfile,
  type StrategyAllocation,
} from "@stablesave/core";

/** One view model for the dashboard, whether the data is simulated or on-chain. */
export interface PortfolioPosition {
  protocolId: ProtocolId;
  name: string;
  amount: number;
  apy: number;
  grade: string;
  weightBps: number;
  marketName: string;
}

export interface HistoryPoint {
  /** Unix ms */
  t: number;
  balance: number;
  earned: number;
}

export interface PendingWithdrawal {
  amount: number;
  requestedAt: number;
  unlockAt: number;
}

export interface Portfolio {
  source: "simulated" | "onchain";
  profile: RiskProfile;
  balance: number;
  earned: number;
  apy: number;
  grade: string;
  allocations: StrategyAllocation[];
  positions: PortfolioPosition[];
  history: HistoryPoint[];
  pending: PendingWithdrawal | null;
  /** What can be withdrawn without a timelock right now (USD). */
  instantAvailable: number;
  limits: { largeWithdrawalThreshold: number; withdrawalTimelockSeconds: number; windowSeconds: number };
  hasDeposits: boolean;
  /** On-chain only: funds still sit in the vault reserve (allocator not live yet). */
  undeployed?: boolean;
}

export function positionsFromBlend(blend: BlendedStrategy, balance: number): PortfolioPosition[] {
  const covered = blend.legs.reduce((s, l) => s + l.allocation.weightBps, 0) || 1;
  return blend.legs.map((leg) => ({
    protocolId: leg.allocation.protocolId,
    name: PROTOCOLS[leg.allocation.protocolId].name,
    amount: (balance * leg.allocation.weightBps) / covered,
    apy: leg.opportunity.yield.totalApy,
    grade: leg.opportunity.safety.display,
    weightBps: leg.allocation.weightBps,
    marketName: leg.opportunity.marketName,
  }));
}

export function blendFor(profile: RiskProfile, opportunities: readonly RatedOpportunity[], amount: number) {
  return blendStrategy(EXAMPLE_VAULT_STRATEGIES[profile], opportunities, amount);
}
