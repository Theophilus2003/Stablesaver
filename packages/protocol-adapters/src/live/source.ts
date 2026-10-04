import { PROTOCOLS, type ProtocolId } from "@stablesave/core";
import { LiveDataUnavailableError } from "../errors";
import type { MarketDataSource, ProtocolMarket } from "../types";

/**
 * Live data integration points. None are wired up yet, and they fail loudly
 * rather than falling back to demo numbers: the service then reports the
 * protocol as unavailable instead of showing stale or invented rates.
 *
 * Suggested integrations:
 * - Kamino:   @kamino-finance/klend-sdk (KaminoMarket.load → reserve.totalSupplyAPY)
 * - MarginFi: @mrgnlabs/marginfi-client-v2 (bank.computeInterestRates)
 * - Drift:    @drift-labs/sdk (calculateDepositRate on the spot market)
 * - Save:     @solendprotocol/solend-sdk or the Save public API
 *
 * Each implementation should return `ProtocolMarket[]` with real TVL,
 * liquidity, utilization and a 30-day APY history from an indexer.
 */
export interface LiveSourceOptions {
  rpcUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class LiveMarketSource implements MarketDataSource {
  readonly mode = "live" as const;
  readonly provider: string;

  constructor(
    private readonly protocol: ProtocolId,
    private readonly options: LiveSourceOptions = {},
  ) {
    this.provider = `${PROTOCOLS[protocol].name} on-chain data`;
  }

  async listMarkets(): Promise<ProtocolMarket[]> {
    const where = this.options.rpcUrl ? ` (RPC configured: ${new URL(this.options.rpcUrl).host})` : "";
    throw new LiveDataUnavailableError(
      this.protocol,
      `Live ${PROTOCOLS[this.protocol].name} data isn't connected yet${where}. See packages/protocol-adapters/src/live/source.ts.`,
    );
  }
}
