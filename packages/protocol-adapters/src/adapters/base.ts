import type { Transaction } from "@solana/web3.js";
import { PROTOCOLS, type Opportunity, type ProtocolId, type RiskData, type StableAsset } from "@stablesave/core";
import { DirectDepositUnavailableError, UnknownMarketError } from "../errors";
import type {
  AdapterCapabilities,
  MarketDataSource,
  ProtocolMarket,
  TransactionParams,
  YieldProtocolAdapter,
} from "../types";

export interface AdapterConfig {
  id: ProtocolId;
  supportedAssets: readonly StableAsset[];
  source: MarketDataSource;
  capabilities?: AdapterCapabilities;
}

/**
 * Shared adapter behaviour: normalizes markets into opportunities and answers
 * the per-market questions from the configured data source.
 *
 * Protocol-specific adapters extend this and override the transaction builders
 * once an SDK integration exists.
 */
export class BaseYieldAdapter implements YieldProtocolAdapter {
  readonly id: ProtocolId;
  readonly name: string;
  readonly network = "solana" as const;
  readonly supportedAssets: readonly StableAsset[];
  readonly officialUrl: string;
  readonly capabilities: AdapterCapabilities;
  readonly source: MarketDataSource;

  constructor(config: AdapterConfig) {
    const info = PROTOCOLS[config.id];
    this.id = config.id;
    this.name = info.name;
    this.officialUrl = info.officialUrl;
    this.supportedAssets = config.supportedAssets;
    this.source = config.source;
    this.capabilities = config.capabilities ?? { directTransactions: false };
  }

  async listOpportunities(): Promise<Opportunity[]> {
    const markets = await this.source.listMarkets();
    const fetchedAt = new Date().toISOString();
    const info = PROTOCOLS[this.id];
    return markets
      .filter((m) => this.supportedAssets.includes(m.asset))
      .map((m) => ({
        id: `${this.id}-${m.marketId}`,
        protocolId: this.id,
        protocolName: this.name,
        productName: m.productName,
        marketName: m.marketName,
        strategyType: m.strategyType,
        description: m.description,
        network: this.network,
        asset: m.asset,
        yield: m.yield,
        tvlUsd: m.tvlUsd,
        liquidityUsd: m.liquidityUsd,
        depositors: m.depositors,
        fees: m.fees,
        risk: m.risk,
        officialUrl: m.officialUrl ?? info.officialUrl,
        officialDomain: info.officialDomain,
        updatedAt: m.updatedAt,
        provenance: {
          mode: this.source.mode,
          provider: this.source.provider,
          fetchedAt,
          ...(this.source.mode === "demo"
            ? { note: `Illustrative numbers for development. Not a real measurement of ${this.name}.` }
            : {}),
        },
      }));
  }

  protected async market(marketId: string): Promise<ProtocolMarket> {
    const markets = await this.source.listMarkets();
    const market = markets.find((m) => m.marketId === marketId);
    if (!market) throw new UnknownMarketError(this.id, marketId);
    return market;
  }

  async getCurrentYield(marketId: string): Promise<number> {
    return (await this.market(marketId)).yield.totalApy;
  }

  async getLiquidity(marketId: string): Promise<number> {
    return (await this.market(marketId)).liquidityUsd;
  }

  async getRiskData(marketId: string): Promise<RiskData> {
    return (await this.market(marketId)).risk;
  }

  async getDepositTransaction(_params: TransactionParams): Promise<Transaction> {
    throw new DirectDepositUnavailableError(this.id, this.officialUrl);
  }

  async getWithdrawTransaction(_params: TransactionParams): Promise<Transaction> {
    throw new DirectDepositUnavailableError(this.id, this.officialUrl);
  }
}
