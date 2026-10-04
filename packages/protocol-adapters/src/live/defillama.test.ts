import { blendStrategy, EXAMPLE_VAULT_STRATEGIES, recommend } from "@stablesave/core";
import { describe, expect, it, vi } from "vitest";
import { createDefaultAdapters, createOpportunityService } from "../service";
import { DefiLlamaClient } from "./defillama-client";
import { DefiLlamaMarketSource, SOLANA_STABLE_MINTS } from "./defillama-source";

/**
 * TEST FIXTURE shaped like DefiLlama's public API responses (field names per
 * yields.llama.fi/pools, /lendBorrow, /chart and api.llama.fi/protocols).
 * The numbers are made up for the test.
 */
const USDC = SOLANA_STABLE_MINTS.USDC;
const USDT = SOLANA_STABLE_MINTS.USDT;

function pool(over: Record<string, unknown>) {
  return {
    chain: "Solana",
    exposure: "single",
    stablecoin: true,
    outlier: false,
    apyReward: null,
    rewardTokens: null,
    poolMeta: null,
    sigma: 0.2,
    underlyingTokens: [USDC],
    ...over,
  };
}

const POOLS = {
  status: "success",
  data: [
    pool({ pool: "kmn-usdc-main", project: "kamino-lend", symbol: "USDC", tvlUsd: 300_000_000, apy: 5.2, apyBase: 4.9, apyReward: 0.3, poolMeta: "Main Market" }),
    pool({ pool: "kmn-usdc-jlp", project: "kamino-lend", symbol: "USDC", tvlUsd: 40_000_000, apy: 8.1, apyBase: 8.1, poolMeta: "JLP Market" }),
    pool({ pool: "kmn-usdt-main", project: "kamino-lend", symbol: "USDT", tvlUsd: 60_000_000, apy: 4.4, apyBase: 4.4, poolMeta: "Main Market", underlyingTokens: [USDT] }),
    pool({ pool: "mfi-usdc", project: "marginfi-lending", symbol: "USDC", tvlUsd: 120_000_000, apy: 4.9, apyBase: 4.5, apyReward: 0.4 }),
    pool({ pool: "drift-usdc", project: "drift-trade", symbol: "USDC", tvlUsd: 110_000_000, apy: 5.6, apyBase: 5.6 }),
    pool({ pool: "save-usdc", project: "save", symbol: "USDC", tvlUsd: 30_000_000, apy: 4.6, apyBase: 4.6, poolMeta: "Main Pool" }),
    // Excluded:
    pool({ pool: "eth-usdc", project: "kamino-lend", symbol: "USDC", chain: "Ethereum", tvlUsd: 900_000_000, apy: 9 }),
    pool({ pool: "kmn-bridged", project: "kamino-lend", symbol: "USDC", tvlUsd: 50_000_000, apy: 7, underlyingTokens: ["BridgedMint111111111111111111111111111111111"] }),
    pool({ pool: "kmn-outlier", project: "kamino-lend", symbol: "USDC", tvlUsd: 50_000_000, apy: 900, outlier: true }),
    pool({ pool: "kmn-dust", project: "kamino-lend", symbol: "USDC", tvlUsd: 1_000, apy: 30 }),
    pool({ pool: "kmn-lp", project: "kamino-lend", symbol: "USDC-USDT", tvlUsd: 80_000_000, apy: 6, exposure: "multi" }),
    { pool: "broken" },
  ],
};

const LEND_BORROW = [
  { pool: "kmn-usdc-main", totalSupplyUsd: 1_400_000_000, totalBorrowUsd: 1_100_000_000 },
  { pool: "mfi-usdc", totalSupplyUsd: 400_000_000, totalBorrowUsd: 280_000_000 },
];

const PROTOCOLS = [
  { slug: "kamino-lend", name: "Kamino Lend", listedAt: 1_696_118_400, audits: "2", audit_links: ["a", "b", "c", "d"], oracles: ["Pyth", "Switchboard"] },
  { slug: "marginfi-lending", name: "marginfi", listedAt: 1_673_740_800, audits: "2", audit_links: ["a", "b"], oracles: ["Pyth"] },
];

function chart(apys: number[]) {
  return { status: "success", data: apys.map((apy, i) => ({ timestamp: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), tvlUsd: 1, apy })) };
}

function mockFetch(overrides: Partial<Record<"pools" | "lendBorrow" | "protocols", () => Response>> = {}) {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/pools")) return overrides.pools?.() ?? json(POOLS);
    if (url.endsWith("/lendBorrow")) return overrides.lendBorrow?.() ?? json(LEND_BORROW);
    if (url.endsWith("/protocols")) return overrides.protocols?.() ?? json(PROTOCOLS);
    if (url.includes("/chart/")) return json(chart(Array.from({ length: 40 }, (_, i) => 5 + Math.sin(i) * 0.2)));
    return new Response("not found", { status: 404 });
  });
}

describe("DefiLlamaMarketSource", () => {
  it("keeps only Solana single-asset USDC/USDT pools on canonical mints", async () => {
    const client = new DefiLlamaClient({ fetch: mockFetch() as unknown as typeof fetch });
    const markets = await new DefiLlamaMarketSource("kamino", { client }).listMarkets();
    expect(markets.map((m) => m.marketName)).toEqual(["Main Market", "JLP Market", "Main Market"]);
    expect(markets.map((m) => m.asset)).toEqual(["USDC", "USDC", "USDT"]);
    expect(new Set(markets.map((m) => m.marketId)).size).toBe(3);
  });

  it("converts percentages, derives liquidity and utilization, and links the source", async () => {
    const client = new DefiLlamaClient({ fetch: mockFetch() as unknown as typeof fetch });
    const [main] = await new DefiLlamaMarketSource("kamino", { client }).listMarkets();
    expect(main!.yield.totalApy).toBeCloseTo(0.052);
    expect(main!.yield.baseApy).toBeCloseTo(0.049);
    expect(main!.yield.rewardApy).toBeCloseTo(0.003);
    expect(main!.tvlUsd).toBe(1_400_000_000);
    expect(main!.liquidityUsd).toBe(300_000_000);
    expect(main!.risk.utilization).toBeCloseTo(1_100 / 1_400);
    expect(main!.risk.apyHistory30d).toHaveLength(30);
    expect(main!.risk.audits).toBe(4);
    expect(main!.risk.oracleSetup).toBe("redundant");
    expect(main!.risk.launchedAt).toBe("2023-10-01");
    expect(main!.risk.incidentsReviewed).toBe(false);
    expect(main!.sourceUrl).toBe("https://defillama.com/yields/pool/kmn-usdc-main");
  });

  it("leaves unknowns unknown instead of guessing", async () => {
    const client = new DefiLlamaClient({ fetch: mockFetch() as unknown as typeof fetch });
    const [drift] = await new DefiLlamaMarketSource("drift", { client }).listMarkets();
    expect(drift!.risk.utilization).toBeNull();
    expect(drift!.risk.audits).toBeNull();
    expect(drift!.risk.oracleSetup).toBe("unknown");
    expect(drift!.risk.bugBountyUsd).toBeNull();
    expect(drift!.depositors).toBeNull();
    // A month of DefiLlama history isn't evidence of a launch date.
    expect(drift!.risk.launchedAt).toBeNull();
  });

  it("still works when optional endpoints fail", async () => {
    const fail = () => new Response("down", { status: 503 });
    const client = new DefiLlamaClient({ fetch: mockFetch({ lendBorrow: fail, protocols: fail }) as unknown as typeof fetch });
    const [main] = await new DefiLlamaMarketSource("kamino", { client }).listMarkets();
    expect(main!.risk.utilization).toBeNull();
    expect(main!.liquidityUsd).toBe(300_000_000);
    expect(main!.risk.audits).toBeNull();
  });

  it("downloads /pools once for all protocols", async () => {
    const fetch = mockFetch();
    const client = new DefiLlamaClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    await Promise.all(["kamino", "marginfi", "drift", "save"].map((p) => new DefiLlamaMarketSource(p as never, { client }).listMarkets()));
    expect(fetch.mock.calls.filter(([u]) => String(u).endsWith("/pools"))).toHaveLength(1);
  });
});

describe("live opportunity service", () => {
  it("rates live markets and labels them live", async () => {
    const client = new DefiLlamaClient({ fetch: mockFetch() as unknown as typeof fetch });
    const service = createOpportunityService({ adapters: createDefaultAdapters("live", { client }) });
    const snapshot = await service.getSnapshot();
    expect(snapshot.mode).toBe("live");
    expect(snapshot.adapters.every((a) => a.status === "ok")).toBe(true);
    expect(snapshot.opportunities.every((o) => o.provenance.mode === "live" && o.provenance.provider === "DefiLlama")).toBe(true);
    for (const o of snapshot.opportunities) {
      expect(o.safety.factors.some((f) => !f.known)).toBe(true);
    }
    const rec = recommend({ amount: 10_000, asset: "USDC", profile: "balanced", opportunities: snapshot.opportunities });
    expect(rec.best).not.toBeNull();
    // Example vault legs resolve to each protocol's largest USDC market.
    const blend = blendStrategy(EXAMPLE_VAULT_STRATEGIES.balanced, snapshot.opportunities, 10_000)!;
    expect(blend.missing).toEqual([]);
    expect(blend.legs.find((l) => l.allocation.protocolId === "kamino")!.opportunity.marketName).toBe("Main Market");
  });

  it("reports every protocol unavailable when DefiLlama is down, with no placeholder rates", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = new DefiLlamaClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    const snapshot = await createOpportunityService({ adapters: createDefaultAdapters("live", { client }) }).getSnapshot();
    expect(snapshot.mode).toBe("live");
    expect(snapshot.opportunities).toEqual([]);
    expect(snapshot.adapters.every((a) => a.status === "unavailable" && /Couldn't reach DefiLlama/.test(a.message ?? ""))).toBe(true);
  });
});
