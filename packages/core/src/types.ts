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

/** Lowercase chain slug, e.g. "solana", "ethereum", "arbitrum", "bsc". */
export type NetworkId = string;

/** Protocols the StableSave Vault (Solana) can allocate to. */
export type ProtocolId = "kamino" | "marginfi" | "drift" | "save";

/** Where market data came from. `demo` data is illustrative only. */
export type DataMode = "demo" | "live";

export type SolanaCluster = "localnet" | "devnet" | "mainnet-beta";

export type StrategyType = "lending" | "curated-vault" | "insurance-fund" | "yield";

export interface YieldBreakdown {
  /** Organic yield paid by borrowers / strategy, net of protocol performance fees. */
  baseApy: number;
  /** Token incentives. Less durable than base yield. */
  rewardApy: number;
  /** baseApy + rewardApy */
  totalApy: number;
  /** Average total APY over the last 30 days, when the source reports it. */
  avgApy30d?: number | null;
  /** Change in total APY over the last 7 days, in rate points (0.001 = +0.1%). */
  apyChange7d?: number | null;
}

/** One day of a pool's rate history. */
export interface RatePoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Total APY that day (decimal). */
  apy: number;
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

export type UpgradeAuthority = "immutable" | "timelocked-multisig" | "multisig" | "single-key" | "unknown";

export type OracleSetup = "none" | "redundant" | "single" | "unknown";

/**
 * Inputs to the StableSave safety assessment.
 *
 * `null` / "unknown" means the data source doesn't provide it and nobody has
 * verified it yet. The risk engine scores unknowns conservatively and says so;
 * it never fills them in with guesses.
 */
export interface RiskData {
  /** When this product went live on mainnet (ISO date). */
  launchedAt: string | null;
  /** Number of public audits. */
  audits: number | null;
  bugBountyUsd: number | null;
  upgradeAuthority: UpgradeAuthority;
  openSource: boolean | null;
  strategyComplexity: "simple" | "moderate" | "complex";
  usesLeverage: boolean;
  incidents: IncidentRecord[];
  /** False when nobody has reviewed this product's incident history yet. Defaults to true. */
  incidentsReviewed?: boolean;
  /** Daily total APY observations for the last ~30 days (decimals). May be empty. */
  apyHistory30d: number[];
  /**
   * Standard deviation of the APY over the pool's history (decimal), when a
   * data provider reports one instead of the series itself.
   */
  apyVolatility?: number | null;
  oracleSetup: OracleSetup;
  oracles: string[];
  /** Share of supplied funds currently borrowed (0..1). High = harder to withdraw. */
  utilization: number | null;
  /** Mandatory wait before withdrawn funds arrive (e.g. an unstaking cooldown). 0 = instant. */
  withdrawalDelayHours: number;
  /** Share of deposits held by the 10 largest depositors (0..1). */
  topDepositorsShare: number | null;
  /** Share of borrows backed by the single largest collateral asset (0..1). */
  collateralConcentration: number | null;
  /** Days this pool has been paying interest, per the data source's history. */
  trackRecordDays?: number | null;
}

export interface DataProvenance {
  mode: DataMode;
  /** e.g. "StableSave demo fixtures" or "DefiLlama". */
  provider: string;
  fetchedAt: string;
  note?: string;
  /** Where the underlying numbers can be checked, e.g. the DefiLlama pool page. */
  sourceUrl?: string;
  /** The source's own id for this pool (DefiLlama pool id), used to fetch its rate history. */
  sourceId?: string;
}

export interface Opportunity {
  /** Stable id, e.g. "kamino-main-usdc" or "aave-v3-ethereum-main-usdt". */
  id: string;
  /** A vault protocol id ("kamino", …) for known Solana protocols, otherwise the DefiLlama project slug. */
  protocolId: string;
  protocolName: string;
  /** Logo URL when the data source provides one. */
  protocolLogo: string | null;
  /** e.g. "USDC Lending" */
  productName: string;
  /** e.g. "Main Market" */
  marketName: string;
  strategyType: StrategyType;
  /** Plain-English description of where the money goes. */
  description: string;
  network: NetworkId;
  /** Display name, e.g. "Ethereum", "BSC". */
  networkName: string;
  asset: StableAsset;
  yield: YieldBreakdown;
  tvlUsd: number;
  /** Funds that could be withdrawn right now. */
  liquidityUsd: number;
  /** Number of depositors, when the source provides it. */
  depositors: number | null;
  /** Total held across the whole protocol (all pools and networks), when known. */
  protocolTvlUsd?: number | null;
  /**
   * Daily rate history (oldest first), when the provider ships it with the
   * listing. Demo data does; live data is fetched per pool on demand.
   */
  rateHistory?: RatePoint[];
  fees: FeeSchedule;
  risk: RiskData;
  /** Official app or site, when known. StableSave never proxies deposits to external protocols. */
  officialUrl: string | null;
  /** Hostname users should verify before connecting a wallet. */
  officialDomain: string | null;
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
  /** False when the inputs for this factor aren't available yet. */
  known: boolean;
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
  /** Provider id: a protocol id in demo mode, "defillama" for live data. */
  id: string;
  name: string;
  mode: DataMode;
  status: "ok" | "unavailable";
  message?: string;
  opportunityCount: number;
}

export interface BestRate {
  opportunityId: string;
  protocolName: string;
  networkName: string;
  apy: number;
  /** The grade letter this is the best rate for: the highest grade available. */
  grade: Grade;
}

export interface MarketSummary {
  optionCount: number;
  protocolCount: number;
  networkCount: number;
  /** Per asset: the highest rate among options with the highest grade available (A if any). */
  bestTopGrade: Partial<Record<StableAsset, BestRate>>;
}

export interface MarketSnapshot {
  mode: DataMode;
  generatedAt: string;
  opportunities: RatedOpportunity[];
  adapters: AdapterStatus[];
  summary: MarketSummary;
  methodologyVersion: string;
  /** Set when market data couldn't be loaded at all. */
  error?: string;
}
