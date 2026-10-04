import { PROTOCOLS, type FeeSchedule, type ProtocolId, type StableAsset } from "@stablesave/core";
import { LiveDataUnavailableError } from "../errors";
import type { MarketDataSource, ProtocolMarket } from "../types";
import {
  getSharedDefiLlamaClient,
  type DefiLlamaClient,
  type DefiLlamaLendBorrow,
  type DefiLlamaPool,
  type DefiLlamaProtocol,
} from "./defillama-client";

export const DEFILLAMA_PROVIDER = "DefiLlama";

/**
 * DefiLlama project slugs per protocol. Projects get renamed over time
 * (Solend → Save, for example), so each protocol accepts several; the first
 * one found in /protocols supplies metadata.
 */
export const DEFILLAMA_PROJECTS: Record<ProtocolId, string[]> = {
  kamino: ["kamino-lend"],
  marginfi: ["marginfi-lending", "marginfi"],
  drift: ["drift-trade", "drift-protocol", "drift"],
  save: ["save", "solend"],
};

/** Canonical Solana mints. Pools whose underlying token differs (bridged copies) are skipped. */
export const SOLANA_STABLE_MINTS: Record<StableAsset, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

const STRATEGY: Record<ProtocolId, { complexity: "simple" | "moderate"; product: (asset: StableAsset) => string; describe: (asset: StableAsset, market: string) => string }> = {
  kamino: {
    complexity: "simple",
    product: (a) => `${a} Lending`,
    describe: (a, m) =>
      `Your ${a} is lent to borrowers in Kamino's ${m}. Borrowers post more collateral than they borrow and pay interest, which is passed on to you.`,
  },
  marginfi: {
    complexity: "simple",
    product: (a) => `${a} Lending`,
    describe: (a, m) => `Your ${a} joins MarginFi's ${m} lending pool. Borrowers pay interest and must keep more collateral than they owe.`,
  },
  drift: {
    complexity: "moderate",
    product: (a) => `${a} Spot Lending`,
    describe: (a) => `Your ${a} is lent to traders on Drift's exchange. It can also back other traders' margin, which adds a layer of exchange risk.`,
  },
  save: {
    complexity: "simple",
    product: (a) => `${a} Lending`,
    describe: (a, m) => `Your ${a} is lent through Save's ${m}. Borrowers post collateral and pay interest.`,
  },
};

/** DefiLlama doesn't report fees; these are StableSave's Solana estimates. */
const SOLANA_FEES: FeeSchedule = {
  depositFeeBps: 0,
  withdrawalFeeBps: 0,
  performanceFeeBps: 0,
  estimatedNetworkFeeUsd: 0.02,
  refundableRentUsd: 0.3,
};

export interface DefiLlamaSourceOptions {
  client?: DefiLlamaClient;
  projects?: string[];
  /** Ignore dust pools. */
  minTvlUsd?: number;
  /** Largest N pools per asset. */
  maxMarketsPerAsset?: number;
}

/**
 * Live markets for one protocol from DefiLlama's yields API. Only Solana,
 * single-asset USDC/USDT pools on the canonical mints are used.
 */
export class DefiLlamaMarketSource implements MarketDataSource {
  readonly mode = "live" as const;
  readonly provider = DEFILLAMA_PROVIDER;
  private readonly client: DefiLlamaClient;
  private readonly projects: string[];
  private readonly minTvlUsd: number;
  private readonly maxMarketsPerAsset: number;

  constructor(
    private readonly protocol: ProtocolId,
    options: DefiLlamaSourceOptions = {},
  ) {
    this.client = options.client ?? getSharedDefiLlamaClient();
    this.projects = options.projects ?? DEFILLAMA_PROJECTS[protocol];
    this.minTvlUsd = options.minTvlUsd ?? 250_000;
    this.maxMarketsPerAsset = options.maxMarketsPerAsset ?? 3;
  }

  async listMarkets(): Promise<ProtocolMarket[]> {
    const name = PROTOCOLS[this.protocol].name;
    let pools: DefiLlamaPool[];
    try {
      pools = await this.client.pools();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new LiveDataUnavailableError(this.protocol, `Live ${name} rates unavailable: ${reason}.`);
    }

    const selected = selectPools(pools, this.projects, this.minTvlUsd, this.maxMarketsPerAsset);
    if (selected.length === 0) {
      throw new LiveDataUnavailableError(
        this.protocol,
        `DefiLlama lists no Solana USDC/USDT pools for ${name} (projects: ${this.projects.join(", ")}).`,
      );
    }

    const [lendBorrow, protocols, charts] = await Promise.all([
      this.client.lendBorrow(),
      this.client.protocols(),
      Promise.all(selected.map(({ pool }) => this.client.chart(pool.pool))),
    ]);
    const meta = this.projects.map((slug) => protocols.get(slug)).find(Boolean) ?? null;
    const fetchedAt = new Date().toISOString();
    const usedIds = new Set<string>();

    return selected.map(({ pool, asset }, i) =>
      toMarket({
        protocol: this.protocol,
        pool,
        asset,
        lendBorrow: lendBorrow.get(pool.pool) ?? null,
        meta,
        chart: charts[i] ?? [],
        fetchedAt,
        usedIds,
      }),
    );
  }
}

interface SelectedPool {
  pool: DefiLlamaPool;
  asset: StableAsset;
}

export function selectPools(
  pools: readonly DefiLlamaPool[],
  projects: readonly string[],
  minTvlUsd: number,
  maxMarketsPerAsset: number,
): SelectedPool[] {
  const out: SelectedPool[] = [];
  for (const asset of ["USDC", "USDT"] as StableAsset[]) {
    const mint = SOLANA_STABLE_MINTS[asset];
    const matches = pools
      .filter(
        (p) =>
          p.chain.toLowerCase() === "solana" &&
          projects.includes(p.project) &&
          p.symbol.toUpperCase() === asset &&
          (p.exposure === null || p.exposure === "single") &&
          p.outlier !== true &&
          p.apy !== null &&
          p.apy >= 0 &&
          p.tvlUsd >= minTvlUsd &&
          (p.underlyingTokens.length === 0 || p.underlyingTokens.includes(mint)),
      )
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, maxMarketsPerAsset);
    out.push(...matches.map((pool) => ({ pool, asset })));
  }
  return out;
}

function toMarket(input: {
  protocol: ProtocolId;
  pool: DefiLlamaPool;
  asset: StableAsset;
  lendBorrow: DefiLlamaLendBorrow | null;
  meta: DefiLlamaProtocol | null;
  chart: Array<{ timestamp: string; apy: number | null }>;
  fetchedAt: string;
  usedIds: Set<string>;
}): ProtocolMarket {
  const { protocol, pool, asset, lendBorrow, meta, chart, fetchedAt, usedIds } = input;
  const strategy = STRATEGY[protocol];

  // DefiLlama reports rates in percent.
  const baseApy = (pool.apyBase ?? pool.apy ?? 0) / 100;
  const rewardApy = (pool.apyReward ?? 0) / 100;
  const totalApy = pool.apy !== null ? pool.apy / 100 : baseApy + rewardApy;

  // For lending pools DefiLlama's tvlUsd is supply minus borrows, i.e. what can be withdrawn now.
  const supplied = lendBorrow?.totalSupplyUsd ?? null;
  const borrowed = lendBorrow?.totalBorrowUsd ?? null;
  const utilization = supplied && supplied > 0 && borrowed !== null ? Math.min(1, Math.max(0, borrowed / supplied)) : null;
  const liquidityUsd = supplied !== null && borrowed !== null ? Math.max(0, supplied - borrowed) : pool.tvlUsd;
  const tvlUsd = supplied ?? pool.tvlUsd;

  const history = chart
    .slice(-30)
    .map((p) => p.apy)
    .filter((v): v is number => v !== null)
    .map((v) => v / 100);

  // Launch date: DefiLlama's listing date for the protocol. Failing that, the
  // start of the pool's DefiLlama history is only a lower bound on its age, so
  // it's used only when it already shows a year or more of history.
  const listedAt = meta?.listedAt ? new Date(meta.listedAt * 1000).toISOString().slice(0, 10) : null;
  const firstSeen = chart[0]?.timestamp ? new Date(chart[0].timestamp) : null;
  const trackedForAYear =
    firstSeen !== null && !Number.isNaN(firstSeen.getTime()) && Date.parse(fetchedAt) - firstSeen.getTime() >= 365 * 86_400_000;
  const launchedAt = listedAt ?? (trackedForAYear ? firstSeen!.toISOString().slice(0, 10) : null);

  const audits = meta ? (meta.auditLinks.length > 0 ? meta.auditLinks.length : meta.audits === "0" ? 0 : null) : null;
  const oracles = meta?.oracles ?? [];

  const marketName = pool.poolMeta ?? "Main pool";
  let marketId = `${slugify(pool.poolMeta ?? "main")}-${asset.toLowerCase()}`;
  if (usedIds.has(marketId)) marketId = `${marketId}-${pool.pool.slice(0, 6).toLowerCase()}`;
  usedIds.add(marketId);

  return {
    marketId,
    productName: strategy.product(asset),
    marketName,
    strategyType: "lending",
    asset,
    description: strategy.describe(asset, marketName),
    yield: { baseApy, rewardApy, totalApy },
    tvlUsd,
    liquidityUsd,
    depositors: null,
    fees: SOLANA_FEES,
    risk: {
      launchedAt,
      audits,
      bugBountyUsd: null,
      upgradeAuthority: "unknown",
      openSource: null,
      strategyComplexity: strategy.complexity,
      usesLeverage: false,
      incidents: [],
      incidentsReviewed: false,
      apyHistory30d: history,
      oracleSetup: oracles.length >= 2 ? "redundant" : oracles.length === 1 ? "single" : "unknown",
      oracles,
      utilization,
      withdrawalDelayHours: 0,
      topDepositorsShare: null,
      collateralConcentration: null,
    },
    updatedAt: fetchedAt,
    sourceUrl: `https://defillama.com/yields/pool/${pool.pool}`,
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "pool"
  );
}
