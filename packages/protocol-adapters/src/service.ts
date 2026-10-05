import {
  summarizeMarket,
  type AdapterStatus,
  type DataMode,
  type MarketSnapshot,
  type ProtocolId,
  type RatedOpportunity,
} from "@stablesave/core";
import { METHODOLOGY_VERSION, rateOpportunities } from "@stablesave/risk-engine";
import { DriftAdapter } from "./adapters/drift";
import { KaminoAdapter } from "./adapters/kamino";
import { MarginfiAdapter } from "./adapters/marginfi";
import { SaveAdapter } from "./adapters/save";
import { DemoMultichainProvider } from "./demo/multichain";
import { DemoMarketSource } from "./demo/source";
import { DefiLlamaMarketsProvider, type DefiLlamaProviderOptions } from "./live/defillama-source";
import type { OpportunityProvider, YieldProtocolAdapter } from "./types";

/** Protocols with an adapter (the ones the StableSave Vault can allocate to). */
export const SUPPORTED_PROTOCOLS: readonly ProtocolId[] = ["kamino", "marginfi", "drift", "save"];

/** The four Solana vault protocols on illustrative fixtures. */
export function createDemoAdapters(): YieldProtocolAdapter[] {
  return [
    new KaminoAdapter(new DemoMarketSource("kamino")),
    new MarginfiAdapter(new DemoMarketSource("marginfi")),
    new DriftAdapter(new DemoMarketSource("drift")),
    new SaveAdapter(new DemoMarketSource("save")),
  ];
}

/**
 * `live` → every USDC/USDT pool DefiLlama tracks, on every network.
 * `demo` → illustrative fixtures: the four Solana vault protocols plus a few
 * options on other networks.
 */
export function createDefaultProviders(mode: DataMode, live: DefiLlamaProviderOptions = {}): OpportunityProvider[] {
  return mode === "demo" ? [...createDemoAdapters(), new DemoMultichainProvider()] : [new DefiLlamaMarketsProvider(live)];
}

export interface OpportunityServiceOptions {
  providers: OpportunityProvider[];
  /** Cache snapshots for this long (ms). Defaults to 60s. */
  ttlMs?: number;
  now?: () => Date;
}

export interface OpportunityService {
  getSnapshot(options?: { fresh?: boolean }): Promise<MarketSnapshot>;
  getOpportunity(id: string): Promise<RatedOpportunity | undefined>;
}

/**
 * Collects opportunities from every provider, rates them with the risk engine
 * and returns one snapshot. A failing provider is reported as `unavailable`;
 * its markets are left out rather than replaced with placeholder numbers.
 */
export function createOpportunityService({ providers, ttlMs = 60_000, now = () => new Date() }: OpportunityServiceOptions): OpportunityService {
  let cache: { at: number; snapshot: Promise<MarketSnapshot> } | undefined;

  async function build(): Promise<MarketSnapshot> {
    const results = await Promise.allSettled(providers.map((p) => p.listOpportunities()));
    const statuses: AdapterStatus[] = [];
    const opportunities: RatedOpportunity[] = [];
    const ratedAt = now();

    results.forEach((result, i) => {
      const provider = providers[i]!;
      if (result.status === "fulfilled") {
        const rated = rateOpportunities(result.value, { now: ratedAt });
        opportunities.push(...rated);
        statuses.push({
          id: provider.id,
          name: provider.name,
          mode: provider.mode,
          status: "ok",
          opportunityCount: rated.length,
        });
      } else {
        statuses.push({
          id: provider.id,
          name: provider.name,
          mode: provider.mode,
          status: "unavailable",
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          opportunityCount: 0,
        });
      }
    });

    // One demo provider makes the whole snapshot demo: the UI labels it as such.
    const mode: DataMode = providers.every((p) => p.mode === "live") ? "live" : "demo";

    return {
      mode,
      generatedAt: ratedAt.toISOString(),
      opportunities,
      adapters: statuses,
      summary: summarizeMarket(opportunities),
      methodologyVersion: METHODOLOGY_VERSION,
    };
  }

  return {
    getSnapshot({ fresh = false } = {}) {
      const t = now().getTime();
      if (!fresh && cache && t - cache.at < ttlMs) return cache.snapshot;
      const snapshot = build();
      cache = { at: t, snapshot };
      snapshot.catch(() => {
        cache = undefined;
      });
      return snapshot;
    },
    async getOpportunity(id) {
      const snapshot = await this.getSnapshot();
      return snapshot.opportunities.find((o) => o.id === id);
    },
  };
}
