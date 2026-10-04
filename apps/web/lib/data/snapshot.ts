import { summarizeMarket, type MarketSnapshot } from "@stablesave/core";
import { createDefaultAdapters, createOpportunityService, type OpportunityService } from "@stablesave/protocol-adapters";
import { METHODOLOGY_VERSION } from "@stablesave/risk-engine";
import { getDataMode } from "../env";

/**
 * Market data access for server components.
 *
 * - With STABLESAVE_API_URL set, read from apps/api.
 * - Otherwise run the protocol adapters in-process.
 *
 * Either way the snapshot carries its own `mode`, and the UI labels demo data.
 */

let service: OpportunityService | undefined;

function localService(): OpportunityService {
  service ??= createOpportunityService({ adapters: createDefaultAdapters(getDataMode()) });
  return service;
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const api = process.env.STABLESAVE_API_URL;
  if (!api) return localService().getSnapshot();

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
