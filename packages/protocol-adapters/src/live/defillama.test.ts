import { blendStrategy, EXAMPLE_VAULT_STRATEGIES, recommend, summarizeMarket } from "@stablesave/core";
import { describe, expect, it, vi } from "vitest";
import { createDefaultProviders, createOpportunityService } from "../service";
import { DefiLlamaClient, type FetchLike } from "./defillama-client";
import {
  DefiLlamaMarketsProvider,
  fetchRateHistory,
  isDefiLlamaPoolId,
  SOLANA_STABLE_MINTS,
  toRateHistory,
} from "./defillama-source";

/**
 * TEST FIXTURE shaped like DefiLlama's public API responses (field names per
 * yields.llama.fi/pools, /lendBorrow and api.llama.fi/protocols).
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
    // Solana vault protocols
    pool({ pool: "kmn-usdc-main", project: "kamino-lend", symbol: "USDC", tvlUsd: 300_000_000, apy: 5.2, apyBase: 4.9, apyReward: 0.3, poolMeta: "Main Market", apyMean30d: 5.05, apyPct7D: -0.12, count: 730 }),
    pool({ pool: "kmn-usdc-jlp", project: "kamino-lend", symbol: "USDC", tvlUsd: 40_000_000, apy: 8.1, apyBase: 8.1, poolMeta: "JLP Market" }),
    pool({ pool: "kmn-usdt-main", project: "kamino-lend", symbol: "USDT", tvlUsd: 60_000_000, apy: 4.4, apyBase: 4.4, poolMeta: "Main Market", underlyingTokens: [USDT] }),
    pool({ pool: "mfi-usdc", project: "marginfi-lending", symbol: "USDC", tvlUsd: 120_000_000, apy: 4.9, apyBase: 4.5, apyReward: 0.4 }),
    pool({ pool: "drift-usdc", project: "drift-trade", symbol: "USDC", tvlUsd: 110_000_000, apy: 5.6, apyBase: 5.6, sigma: null }),
    pool({ pool: "save-usdc", project: "save", symbol: "USDC", tvlUsd: 30_000_000, apy: 4.6, apyBase: 4.6, poolMeta: "Main Pool" }),
    // Other networks and protocols
    pool({ pool: "aave-eth-usdt", project: "aave-v3", chain: "Ethereum", symbol: "USDT", tvlUsd: 2_000_000_000, apy: 3.7, apyBase: 3.7, underlyingTokens: ["0xdac17f958d2ee523a2206206994597c13d831ec7"] }),
    pool({ pool: "aave-arb-usdc", project: "aave-v3", chain: "Arbitrum", symbol: "USDC", tvlUsd: 150_000_000, apy: 4.1, apyBase: 4.1, underlyingTokens: ["0xaf88"] }),
    pool({ pool: "morpho-base-usdc", project: "morpho-blue", chain: "Base", symbol: "USDC", tvlUsd: 90_000_000, apy: 6.3, apyBase: 5.1, apyReward: 1.2, poolMeta: "Steakhouse USDC", underlyingTokens: ["0x8335"] }),
    pool({ pool: "plasma-usdt0", project: "fluid-lending", chain: "Plasma", symbol: "USDT0", tvlUsd: 70_000_000, apy: 7.2, apyBase: 4.2, apyReward: 3, underlyingTokens: ["0xb8ce"] }),
    pool({ pool: "hl-usdc", project: "mystery-yield", chain: "Hyperliquid L1", symbol: "USDC", tvlUsd: 5_000_000, apy: 9.5, apyBase: 9.5, underlyingTokens: [] }),
    // Excluded:
    pool({ pool: "aave-avax-usdce", project: "aave-v3", chain: "Avalanche", symbol: "USDC.E", tvlUsd: 50_000_000, apy: 5 }),
    pool({ pool: "kmn-bridged", project: "kamino-lend", symbol: "USDC", tvlUsd: 50_000_000, apy: 7, underlyingTokens: ["BridgedMint111111111111111111111111111111111"] }),
    pool({ pool: "kmn-outlier", project: "kamino-lend", symbol: "USDC", tvlUsd: 50_000_000, apy: 900, outlier: true }),
    pool({ pool: "eth-too-good", project: "aave-v3", chain: "Ethereum", symbol: "USDC", tvlUsd: 50_000_000, apy: 75 }),
    pool({ pool: "kmn-dust", project: "kamino-lend", symbol: "USDC", tvlUsd: 900_000, apy: 30 }),
    pool({ pool: "kmn-lp", project: "kamino-lend", symbol: "USDC-USDT", tvlUsd: 80_000_000, apy: 6, exposure: "multi" }),
    { pool: "broken" },
  ],
};

const LEND_BORROW = [
  { pool: "kmn-usdc-main", totalSupplyUsd: 1_400_000_000, totalBorrowUsd: 1_100_000_000 },
  { pool: "mfi-usdc", totalSupplyUsd: 400_000_000, totalBorrowUsd: 280_000_000 },
  { pool: "aave-eth-usdt", totalSupplyUsd: 5_000_000_000, totalBorrowUsd: 3_000_000_000 },
];

const PROTOCOLS = [
  { slug: "kamino-lend", name: "Kamino Lend", category: "Lending", tvl: 2_500_000_000, listedAt: 1_696_118_400, audits: "2", audit_links: ["a", "b", "c", "d"], oracles: ["Pyth", "Switchboard"], url: "https://kamino.finance", logo: "https://icons.llama.fi/kamino.png" },
  { slug: "marginfi-lending", name: "marginfi", category: "Lending", listedAt: 1_673_740_800, audits: "2", audit_links: ["a", "b"], oracles: ["Pyth"] },
  { slug: "drift-trade", name: "Drift", category: "Derivatives", audits: "2", audit_links: [] },
  { slug: "aave-v3", name: "Aave V3", category: "Lending", listedAt: 1_647_302_400, audits: "2", audit_links: ["a", "b", "c"], oracles: ["Chainlink"], url: "https://aave.com", logo: "https://icons.llama.fi/aave-v3.png" },
  { slug: "morpho-blue", name: "Morpho", category: "Lending", listedAt: 1_704_067_200, audits: "2", audit_links: ["a"], url: "https://app.morpho.org/", logo: "javascript:alert(1)" },
  { slug: "fluid-lending", name: "Fluid Lending", category: "Yield Aggregator", url: "https://fluid.io" },
];

function mockFetch(overrides: Partial<Record<"pools" | "lendBorrow" | "protocols", () => Response>> = {}) {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/pools")) return overrides.pools?.() ?? json(POOLS);
    if (url.endsWith("/lendBorrow")) return overrides.lendBorrow?.() ?? json(LEND_BORROW);
    if (url.endsWith("/protocols")) return overrides.protocols?.() ?? json(PROTOCOLS);
    return new Response("not found", { status: 404 });
  });
}

function provider(fetch = mockFetch()) {
  return new DefiLlamaMarketsProvider({ client: new DefiLlamaClient({ fetch: fetch as unknown as FetchLike }) });
}

const byPool = (opps: Awaited<ReturnType<DefiLlamaMarketsProvider["listOpportunities"]>>, poolId: string) =>
  opps.find((o) => o.provenance.sourceUrl?.endsWith(`/${poolId}`))!;

describe("DefiLlamaMarketsProvider", () => {
  it("covers every network, keeping only single-asset USDC/USDT pools", async () => {
    const opps = await provider().listOpportunities();
    const pools = opps.map((o) => o.provenance.sourceUrl!.split("/").pop()).sort();
    expect(pools).toEqual(
      ["aave-arb-usdc", "aave-eth-usdt", "drift-usdc", "hl-usdc", "kmn-usdc-jlp", "kmn-usdc-main", "kmn-usdt-main", "mfi-usdc", "morpho-base-usdc", "plasma-usdt0", "save-usdc"].sort(),
    );
    expect(new Set(opps.map((o) => o.network))).toEqual(new Set(["solana", "ethereum", "arbitrum", "base", "plasma", "hyperliquid-l1"]));
    expect(byPool(opps, "plasma-usdt0").asset).toBe("USDT");
    expect(new Set(opps.map((o) => o.id)).size).toBe(opps.length);
  });

  it("keeps the vault protocols' Solana pools when bigger pools elsewhere fill the list", async () => {
    const small = new DefiLlamaMarketsProvider({ client: new DefiLlamaClient({ fetch: mockFetch() as unknown as FetchLike }), maxPerAsset: 2 });
    const pools = (await small.listOpportunities()).map((o) => o.provenance.sourceUrl!.split("/").pop());
    // Top 2 USDC by TVL are Kamino Main and Arbitrum Aave; the other Kamino, MarginFi, Drift and
    // Save USDC pools stay, Base Morpho and Hyperliquid don't.
    expect(pools).toEqual(expect.arrayContaining(["kmn-usdc-main", "aave-arb-usdc", "mfi-usdc", "drift-usdc", "kmn-usdc-jlp", "save-usdc"]));
    expect(pools).not.toContain("morpho-base-usdc");
    expect(pools).not.toContain("hl-usdc");
  });

  it("maps the vault protocols to their ids and keeps everyone else's DefiLlama slug", async () => {
    const opps = await provider().listOpportunities();
    const kamino = byPool(opps, "kmn-usdc-main");
    expect(kamino.id).toBe("kamino-solana-main-market-usdc");
    expect(kamino.protocolId).toBe("kamino");
    expect(kamino.protocolName).toBe("Kamino");
    expect(kamino.officialUrl).toBe("https://app.kamino.finance");
    expect(kamino.protocolLogo).toBe("https://icons.llama.fi/kamino.png");
    expect(byPool(opps, "drift-usdc").strategyType).toBe("lending");

    const aave = byPool(opps, "aave-eth-usdt");
    expect(aave.protocolId).toBe("aave-v3");
    expect(aave.protocolName).toBe("Aave V3");
    expect(aave.networkName).toBe("Ethereum");
    expect(aave.officialUrl).toBe("https://aave.com");
    expect(aave.officialDomain).toBe("aave.com");

    const morpho = byPool(opps, "morpho-base-usdc");
    expect(morpho.marketName).toBe("Steakhouse USDC");
    expect(morpho.protocolLogo).toBeNull(); // non-https logo dropped
    expect(morpho.officialDomain).toBe("app.morpho.org");
  });

  it("converts percentages, derives liquidity and utilization, and links the source", async () => {
    const opps = await provider().listOpportunities();
    const main = byPool(opps, "kmn-usdc-main");
    expect(main.yield.totalApy).toBeCloseTo(0.052);
    expect(main.yield.baseApy).toBeCloseTo(0.049);
    expect(main.yield.rewardApy).toBeCloseTo(0.003);
    expect(main.tvlUsd).toBe(1_400_000_000);
    expect(main.liquidityUsd).toBe(300_000_000);
    expect(main.risk.utilization).toBeCloseTo(1_100 / 1_400);
    expect(main.risk.apyVolatility).toBeCloseTo(0.002);
    expect(main.risk.audits).toBe(4);
    expect(main.risk.oracleSetup).toBe("redundant");
    expect(main.risk.launchedAt).toBe("2023-10-01");
    expect(main.risk.incidentsReviewed).toBe(false);
    expect(main.provenance.sourceUrl).toBe("https://defillama.com/yields/pool/kmn-usdc-main");
    expect(main.provenance.sourceId).toBe("kmn-usdc-main");
  });

  it("passes on the 30-day average, the 7-day change, the track record and the protocol's size", async () => {
    const opps = await provider().listOpportunities();
    const main = byPool(opps, "kmn-usdc-main");
    expect(main.yield.avgApy30d).toBeCloseTo(0.0505);
    expect(main.yield.apyChange7d).toBeCloseTo(-0.0012);
    expect(main.risk.trackRecordDays).toBe(730);
    expect(main.protocolTvlUsd).toBe(2_500_000_000);
    const drift = byPool(opps, "drift-usdc");
    expect(drift.yield.avgApy30d).toBeNull();
    expect(drift.yield.apyChange7d).toBeNull();
    expect(drift.risk.trackRecordDays).toBeNull();
    expect(drift.protocolTvlUsd).toBeNull();
  });

  it("estimates network fees per chain", async () => {
    const opps = await provider().listOpportunities();
    expect(byPool(opps, "kmn-usdc-main").fees.estimatedNetworkFeeUsd).toBe(0.02);
    expect(byPool(opps, "aave-eth-usdt").fees.estimatedNetworkFeeUsd).toBe(12);
    expect(byPool(opps, "aave-arb-usdc").fees.estimatedNetworkFeeUsd).toBe(0.2);
    // Unlisted chain: a conservative default, and DefiLlama's chain name.
    const hl = byPool(opps, "hl-usdc");
    expect(hl.fees.estimatedNetworkFeeUsd).toBe(1);
    expect(hl.networkName).toBe("Hyperliquid L1");
  });

  it("describes strategies from DefiLlama's category", async () => {
    const opps = await provider().listOpportunities();
    expect(byPool(opps, "aave-eth-usdt").strategyType).toBe("lending");
    expect(byPool(opps, "plasma-usdt0").strategyType).toBe("curated-vault");
    expect(byPool(opps, "hl-usdc").strategyType).toBe("yield");
    expect(byPool(opps, "hl-usdc").protocolName).toBe("Mystery Yield");
    expect(byPool(opps, "hl-usdc").officialUrl).toBeNull();
  });

  it("leaves unknowns unknown instead of guessing", async () => {
    const opps = await provider().listOpportunities();
    const drift = byPool(opps, "drift-usdc");
    expect(drift.risk.utilization).toBeNull();
    expect(drift.risk.audits).toBeNull();
    expect(drift.risk.oracleSetup).toBe("unknown");
    expect(drift.risk.bugBountyUsd).toBeNull();
    expect(drift.risk.apyVolatility).toBeNull();
    expect(drift.risk.launchedAt).toBeNull();
    expect(drift.depositors).toBeNull();
  });

  it("still works when optional endpoints fail", async () => {
    const fail = () => new Response("down", { status: 503 });
    const opps = await provider(mockFetch({ lendBorrow: fail, protocols: fail })).listOpportunities();
    const main = byPool(opps, "kmn-usdc-main");
    expect(main.risk.utilization).toBeNull();
    expect(main.liquidityUsd).toBe(300_000_000);
    expect(main.risk.audits).toBeNull();
    expect(byPool(opps, "aave-eth-usdt").protocolName).toBe("Aave V3");
  });

  it("downloads /pools once and never fetches per-pool history", async () => {
    const fetch = mockFetch();
    const p = provider(fetch);
    await Promise.all([p.listOpportunities(), p.listOpportunities()]);
    expect(fetch.mock.calls.filter(([u]) => String(u).endsWith("/pools"))).toHaveLength(1);
    expect(fetch.mock.calls.some(([u]) => String(u).includes("/chart/"))).toBe(false);
  });
});

describe("live opportunity service", () => {
  const client = () => new DefiLlamaClient({ fetch: mockFetch() as unknown as FetchLike });

  it("rates every network's options and labels them live", async () => {
    const service = createOpportunityService({ providers: createDefaultProviders("live", { client: client() }) });
    const snapshot = await service.getSnapshot();
    expect(snapshot.mode).toBe("live");
    expect(snapshot.adapters).toEqual([expect.objectContaining({ id: "defillama", status: "ok", opportunityCount: 11 })]);
    expect(snapshot.summary.networkCount).toBe(6);
    expect(snapshot.opportunities.every((o) => o.provenance.mode === "live" && o.provenance.provider === "DefiLlama")).toBe(true);
    for (const o of snapshot.opportunities) {
      expect(o.safety.factors.some((f) => !f.known)).toBe(true);
    }
    // Example vault legs resolve to each protocol's largest Solana USDC market.
    const blend = blendStrategy(EXAMPLE_VAULT_STRATEGIES.balanced, snapshot.opportunities, 10_000)!;
    expect(blend.missing).toEqual([]);
    expect(blend.legs.find((l) => l.allocation.protocolId === "kamino")!.opportunity.marketName).toBe("Main Market");
  });

  it("counts network fees: Ethereum loses on small amounts", async () => {
    const { opportunities } = await createOpportunityService({ providers: createDefaultProviders("live", { client: client() }) }).getSnapshot();
    const small = recommend({ amount: 100, asset: "USDT", profile: "bigger", opportunities });
    const aave = small.ranked.find((o) => o.opportunity.network === "ethereum")!;
    expect(aave.eligible).toBe(false);
    expect(aave.ineligibleReason).toBe("fees");
    const large = recommend({ amount: 1_000_000, asset: "USDT", profile: "bigger", opportunities });
    expect(large.ranked.find((o) => o.opportunity.network === "ethereum")!.eligible).toBe(true);
  });

  it("falls back to the safest option, marked as below the setting, when nothing is graded A", async () => {
    const snapshot = await createOpportunityService({ providers: createDefaultProviders("live", { client: client() }) }).getSnapshot();
    expect(snapshot.summary.bestTopGrade.USDC!.grade).toBe("A");
    const opportunities = snapshot.opportunities.filter((o) => o.safety.grade !== "A");
    const safe = recommend({ amount: 10_000, asset: "USDC", profile: "safe", opportunities });
    expect(safe.best).toBeNull();
    const safest = Math.max(...safe.ranked.map((r) => r.opportunity.safety.score));
    expect(safe.closest!.opportunity.safety.score).toBe(safest);
    expect(safe.closest!.eligible).toBe(false);
    // The summary reports the best rate at the highest grade that exists.
    expect(summarizeMarket(opportunities).bestTopGrade.USDC!.grade).toBe("B");
    const balanced = recommend({ amount: 10_000, asset: "USDC", profile: "balanced", opportunities });
    expect(balanced.best).not.toBeNull();
    expect(balanced.closest).toBeNull();
  });

  it("reports the provider unavailable when DefiLlama is down, with no placeholder rates", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const providers = createDefaultProviders("live", { client: new DefiLlamaClient({ fetch: fetch as unknown as FetchLike }) });
    const snapshot = await createOpportunityService({ providers }).getSnapshot();
    expect(snapshot.mode).toBe("live");
    expect(snapshot.opportunities).toEqual([]);
    expect(snapshot.adapters).toHaveLength(1);
    expect(snapshot.adapters[0]!.status).toBe("unavailable");
    expect(snapshot.adapters[0]!.message).toMatch(/Couldn't reach DefiLlama/);
  });
});

describe("rate history", () => {
  const POOL_ID = "747c1d2a-c668-4682-b9f9-296708a3dd90";

  it("keeps one rate per day, oldest first, as decimals", () => {
    const history = toRateHistory(
      [
        { timestamp: "2026-10-02T23:01:00.000Z", apy: 4.1, tvlUsd: 1 },
        { timestamp: "2026-10-01T23:01:00.000Z", apy: 4, tvlUsd: 1 },
        { timestamp: "2026-10-02T23:59:00.000Z", apy: 4.2, tvlUsd: 1 },
        { timestamp: "2026-10-03T23:01:00.000Z", apy: null, tvlUsd: 1 },
        { timestamp: "garbage", apy: 3, tvlUsd: 1 },
      ],
      90,
    );
    expect(history.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(history[0]!.apy).toBeCloseTo(0.04);
    expect(history[1]!.apy).toBeCloseTo(0.042);
  });

  it("returns only the most recent days", () => {
    const points = Array.from({ length: 120 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      apy: i,
      tvlUsd: 1,
    }));
    const history = toRateHistory(points, 90);
    expect(history).toHaveLength(90);
    expect(history.at(-1)!.date).toBe("2026-04-30");
    expect(history.at(-1)!.apy).toBeCloseTo(1.19);
  });

  it("fetches a pool's chart and rejects ids that aren't DefiLlama pool ids", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith(`/chart/${POOL_ID}`)
        ? new Response(JSON.stringify({ status: "success", data: [{ timestamp: "2026-10-01T23:01:00.000Z", apy: 3.76, tvlUsd: 1 }] }))
        : new Response("not found", { status: 404 }),
    );
    const client = new DefiLlamaClient({ fetch: fetch as unknown as FetchLike });
    expect(isDefiLlamaPoolId(POOL_ID)).toBe(true);
    expect(isDefiLlamaPoolId("../pools")).toBe(false);
    const history = await fetchRateHistory(POOL_ID, { client });
    expect(history).toHaveLength(1);
    expect(history[0]!.date).toBe("2026-10-01");
    expect(history[0]!.apy).toBeCloseTo(0.0376);
    expect(await fetchRateHistory("../pools", { client })).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
