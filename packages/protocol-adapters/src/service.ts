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
import { DemoMarketSource } from "./demo/source";
import { LiveMarketSource, type LiveSourceOptions } from "./live/source";
import type { MarketDataSource, YieldProtocolAdapter } from "./types";

export const SUPPORTED_PROTOCOLS: readonly ProtocolId[] = ["kamino", "marginfi", "drift", "save"];

export function createSource(protocol: ProtocolId, mode: DataMode, live: LiveSourceOptions = {}): MarketDataSource {
  return mode === "demo" ? new DemoMarketSource(protocol) : new LiveMarketSource(protocol, live);
}

export function createDefaultAdapters(mode: DataMode, live: LiveSourceOptions = {}): YieldProtocolAdapter[] {
  return [
    new KaminoAdapter(createSource("kamino", mode, live)),
    new MarginfiAdapter(createSource("marginfi", mode, live)),
    new DriftAdapter(createSource("drift", mode, live)),
    new SaveAdapter(createSource("save", mode, live)),
  ];
}

export interface OpportunityServiceOptions {
  adapters: YieldProtocolAdapter[];
  /** Cache snapshots for this long (ms). Defaults to 60s. */
  ttlMs?: number;
  now?: () => Date;
}

export interface OpportunityService {
  getSnapshot(options?: { fresh?: boolean }): Promise<MarketSnapshot>;
  getOpportunity(id: string): Promise<RatedOpportunity | undefined>;
}

/**
 * Collects markets from every adapter, rates them with the risk engine and
 * returns one snapshot. A failing adapter is reported as `unavailable`; its
 * markets are left out rather than replaced with placeholder numbers.
 */
export function createOpportunityService({ adapters, ttlMs = 60_000, now = () => new Date() }: OpportunityServiceOptions): OpportunityService {
  let cache: { at: number; snapshot: Promise<MarketSnapshot> } | undefined;

  async function build(): Promise<MarketSnapshot> {
    const results = await Promise.allSettled(adapters.map((a) => a.listOpportunities()));
    const statuses: AdapterStatus[] = [];
    const opportunities: RatedOpportunity[] = [];
    const ratedAt = now();

    results.forEach((result, i) => {
      const adapter = adapters[i]!;
      if (result.status === "fulfilled") {
        const rated = rateOpportunities(result.value, { now: ratedAt });
        opportunities.push(...rated);
        statuses.push({
          protocolId: adapter.id,
          name: adapter.name,
          mode: adapter.source.mode,
          status: "ok",
          opportunityCount: rated.length,
        });
      } else {
        statuses.push({
          protocolId: adapter.id,
          name: adapter.name,
          mode: adapter.source.mode,
          status: "unavailable",
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          opportunityCount: 0,
        });
      }
    });

    // One demo source makes the whole snapshot demo: the UI labels it as such.
    const mode: DataMode = adapters.every((a) => a.source.mode === "live") ? "live" : "demo";

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
