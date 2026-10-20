import { summarizeMarket, type MarketSnapshot } from "@stablesave/core";
import { unstable_cache } from "next/cache";
import { createDefaultProviders, createOpportunityService, type OpportunityService } from "@stablesave/protocol-adapters";
import { METHODOLOGY_VERSION } from "@stablesave/risk-engine";
import { getDataMode } from "../env";

/**
 * Market data access for server components.
 *
 * - With STABLESAVE_API_URL set, read from apps/api.
 * - Otherwise load and rate the data in-process.
 *
 * Either way the snapshot carries its own `mode`, and the UI labels demo data.
 */

let service: OpportunityService | undefined;

function localService(): OpportunityService {
  service ??= createOpportunityService({ providers: createDefaultProviders(getDataMode()) });
  return service;
}

/** Thrown inside the cache so a snapshot with no opportunities (sources down) isn't kept. */
class EmptySnapshot extends Error {
  constructor(readonly snapshot: MarketSnapshot) {
    super("No opportunities");
  }
}

/**
 * The rated snapshot, shared across server instances for five minutes (and refreshed in the
 * background), so a cold start doesn't wait on DefiLlama. That matters for link previews: X and
 * other crawlers give up on slow pages and images.
 */
const sharedSnapshot = unstable_cache(
  async () => {
    const snapshot = await localService().getSnapshot();
    if (snapshot.opportunities.length === 0) throw new EmptySnapshot(snapshot);
    return snapshot;
  },
  ["market-snapshot"],
  { revalidate: 300 },
);

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const api = process.env.STABLESAVE_API_URL;
  if (!api) {
    try {
      return await sharedSnapshot();
    } catch (error) {
      return error instanceof EmptySnapshot ? error.snapshot : localService().getSnapshot();
    }
  }

  try {
    const res = await fetch(`${api.replace(/\/$/, "")}/v1/opportunities`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    return (await res.json()) as MarketSnapshot;
  } catch (error) {
    return unavailableSnapshot(error instanceof Error ? error.message : "Market data API unreachable");
  }
}

export async function getOpportunity(id: string) {
  const snapshot = await getMarketSnapshot();
  return { snapshot, opportunity: snapshot.opportunities.find((o) => o.id === id) };
}

function unavailableSnapshot(message: string): MarketSnapshot {
  return {
    mode: getDataMode(),
    generatedAt: new Date().toISOString(),
    opportunities: [],
    adapters: [],
    summary: summarizeMarket([]),
    methodologyVersion: METHODOLOGY_VERSION,
    error: message,
  };
}
