/**
 * Shared StableSave domain model.
 *
 * Conventions:
 * - Rates (APY, utilization, shares) are decimals: 0.0515 === 5.15%.
 * - Money is in USD (stablecoins are treated as ~$1). On-chain code works in
 *   base units; conversion happens at the edges.
 * - Every piece of market data carries provenance so the UI can never present
 *   demo numbers as live ones.
 */

export const STABLE_ASSETS = ["USDC", "USDT"] as const;
export type StableAsset = (typeof STABLE_ASSETS)[number];

export type NetworkId = "solana" | "ethereum" | "base";

export type ProtocolId = "kamino" | "marginfi" | "drift" | "save";

/** Where market data came from. `demo` data is illustrative only. */
export type DataMode = "demo" | "live";

export type SolanaCluster = "localnet" | "devnet" | "mainnet-beta";

export type StrategyType = "lending" | "curated-vault" | "insurance-fund";

export interface YieldBreakdown {
  /** Organic yield paid by borrowers / strategy, net of protocol performance fees. */
  baseApy: number;
  /** Token incentives. Less durable than base yield. */
  rewardApy: number;
  /** baseApy + rewardApy */
  totalApy: number;
}

export interface FeeSchedule {
  /** Charged on the amount deposited. */
  depositFeeBps: number;
  /** Charged on the amount withdrawn (principal + yield). */
  withdrawalFeeBps: number;
  /**
   * Fee the protocol takes from yield. Already netted out of `YieldBreakdown`;
   * shown for disclosure only.
   */
  performanceFeeBps: number;
  /** Estimated cost of the deposit and withdrawal transactions, incl. priority fees. */
  estimatedNetworkFeeUsd: number;
  /** One-off account rent. Recoverable when the account is closed, so not counted as a fee. */
  refundableRentUsd: number;
}

export type IncidentSeverity = "minor" | "major" | "critical";

export interface IncidentRecord {
  date: string;
  severity: IncidentSeverity;
  fundsLost: boolean;
  usersReimbursed: boolean;
  summary: string;
}

export type UpgradeAuthority = "immutable" | "timelocked-multisig" | "multisig" | "single-key";

export type OracleSetup = "none" | "redundant" | "single";

/** Inputs to the StableSave safety assessment. */
export interface RiskData {
  /** When this product went live on mainnet (ISO date). */
  launchedAt: string;
  audits: number;
  bugBountyUsd: number;
  upgradeAuthority: UpgradeAuthority;
  openSource: boolean;
  strategyComplexity: "simple" | "moderate" | "complex";
  usesLeverage: boolean;
  incidents: IncidentRecord[];
  /** Daily total APY observations for the last ~30 days (decimals). */
  apyHistory30d: number[];
  oracleSetup: OracleSetup;
  oracles: string[];
  /** Share of supplied funds currently borrowed (0..1). High = harder to withdraw. */
  utilization: number;
  /** Mandatory wait before withdrawn funds arrive (e.g. an unstaking cooldown). 0 = instant. */
  withdrawalDelayHours: number;
  /** Share of deposits held by the 10 largest depositors (0..1). */
  topDepositorsShare: number;
  /** Share of borrows backed by the single largest collateral asset (0..1). */
  collateralConcentration: number;
}

export interface DataProvenance {
  mode: DataMode;
  /** e.g. "StableSave demo fixtures" or "Kamino API". */
  provider: string;
  fetchedAt: string;
  note?: string;
}

export interface Opportunity {
  /** Stable id, e.g. "kamino-main-usdc". */
  id: string;
  protocolId: ProtocolId;
  protocolName: string;
  /** e.g. "USDC Lending" */
  productName: string;
  /** e.g. "Main Market" */
  marketName: string;
  strategyType: StrategyType;
  /** Plain-English description of where the money goes. */
  description: string;
  network: NetworkId;
  asset: StableAsset;
  yield: YieldBreakdown;
  tvlUsd: number;
  /** Funds that could be withdrawn right now. */
  liquidityUsd: number;
  depositors: number;
  fees: FeeSchedule;
  risk: RiskData;
  /** Official app URL. StableSave never proxies deposits to external protocols. */
  officialUrl: string;
  /** Hostname users should verify before connecting a wallet. */
  officialDomain: string;
  updatedAt: string;
  provenance: DataProvenance;
}

export type Grade = "A" | "B" | "C" | "D";
export type GradeModifier = "+" | "-" | "";

export type RiskFactorId =
  | "maturity"
  | "tvl"
  | "liquidity"
  | "smartContract"
  | "complexity"
  | "incidents"
  | "yieldVolatility"
  | "oracle"
  | "concentration";

export type FactorImpact = "positive" | "neutral" | "negative";

export interface FactorAssessment {
  id: RiskFactorId;
  label: string;
  /** Relative weight in the overall score (all weights sum to 100). */
  weight: number;
  /** 0..100, higher is safer. */
  score: number;
  impact: FactorImpact;
  /** Plain-English explanation. */
  detail: string;
}

export interface SafetyAssessment {
  grade: Grade;
  modifier: GradeModifier;
  /** e.g. "A-" */
  display: string;
  /** 0..100 */
  score: number;
  /** e.g. "Safer" */
  label: string;
  summary: string;
  reasons: string[];
  factors: FactorAssessment[];
  /** Hard limits that lowered the grade, in plain English. */
  caps: string[];
  methodologyVersion: string;
}

export interface RatedOpportunity extends Opportunity {
  safety: SafetyAssessment;
}

export interface AdapterStatus {
  protocolId: ProtocolId;
  name: string;
  mode: DataMode;
  status: "ok" | "unavailable";
  message?: string;
  opportunityCount: number;
}

export interface BestRate {
  opportunityId: string;
  protocolName: string;
  apy: number;
}

export interface MarketSummary {
  optionCount: number;
  protocolCount: number;
  bestGradeA: Partial<Record<StableAsset, BestRate>>;
}

export interface MarketSnapshot {
  mode: DataMode;
  generatedAt: string;
  opportunities: RatedOpportunity[];
  adapters: AdapterStatus[];
  summary: MarketSummary;
  methodologyVersion: string;
}
