import type { Transaction } from "@solana/web3.js";
import type {
  DataMode,
  FeeSchedule,
  NetworkId,
  Opportunity,
  ProtocolId,
  RiskData,
  StableAsset,
  StrategyType,
  YieldBreakdown,
} from "@stablesave/core";

/** One market (pool / reserve / vault) inside a protocol. */
export interface ProtocolMarket {
  /** Unique within the protocol, e.g. "main-usdc". */
  marketId: string;
  productName: string;
  marketName: string;
  strategyType: StrategyType;
  asset: StableAsset;
  description: string;
  yield: YieldBreakdown;
  tvlUsd: number;
  liquidityUsd: number;
  depositors: number | null;
  fees: FeeSchedule;
  risk: RiskData;
  /** Deep link into the official app for this market, if known. */
  officialUrl?: string;
  /** Where the numbers can be checked (e.g. the DefiLlama pool page). */
  sourceUrl?: string;
  updatedAt: string;
}

/**
 * Where an adapter gets its numbers. Swap `DemoMarketSource` for a live source
 * without touching the adapter or the UI.
 */
export interface MarketDataSource {
  readonly mode: DataMode;
  /** Human-readable provider, shown in the UI ("StableSave demo fixtures", "Kamino API"). */
  readonly provider: string;
  listMarkets(): Promise<ProtocolMarket[]>;
}

export interface TransactionParams {
  marketId: string;
  /** Owner wallet (base58). */
  owner: string;
  /** Amount in token base units (USDC/USDT use 6 decimals). */
  amount: bigint;
}

export interface AdapterCapabilities {
  /** Adapter can build deposit/withdraw transactions itself. */
  directTransactions: boolean;
}

/**
 * Common interface for every yield protocol StableSave compares.
 *
 * Yield and liquidity calls take a market id because protocols expose several
 * markets per asset. All rates are decimals (0.0515 === 5.15%).
 */
export interface YieldProtocolAdapter {
  readonly id: ProtocolId;
  readonly name: string;
  readonly network: NetworkId;
  readonly supportedAssets: readonly StableAsset[];
  readonly officialUrl: string;
  readonly capabilities: AdapterCapabilities;
  readonly source: MarketDataSource;

  /** Every market as a normalized opportunity (unrated). */
  listOpportunities(): Promise<Opportunity[]>;

  /** Current total APY for a market. */
  getCurrentYield(marketId: string): Promise<number>;
  /** USD that could be withdrawn from the market right now. */
  getLiquidity(marketId: string): Promise<number>;
  /** Inputs for the safety assessment. */
  getRiskData(marketId: string): Promise<RiskData>;

  /**
   * Unsigned transactions for the official protocol program. Adapters that
   * can't build them throw `DirectDepositUnavailableError`; the UI then links
   * to the official app instead.
   */
  getDepositTransaction(params: TransactionParams): Promise<Transaction>;
  getWithdrawTransaction(params: TransactionParams): Promise<Transaction>;
}
