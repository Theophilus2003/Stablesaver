import {
  PROTOCOLS,
  type RatePoint,
  getNetwork,
  networkIdFromName,
  type FeeSchedule,
  type Opportunity,
  type ProtocolId,
  type StableAsset,
  type StrategyType,
} from "@stablesave/core";
import { LiveDataUnavailableError } from "../errors";
import type { OpportunityProvider } from "../types";
import {
  getSharedDefiLlamaClient,
  type DefiLlamaChartPoint,
  type DefiLlamaClient,
  type DefiLlamaLendBorrow,
  type DefiLlamaPool,
  type DefiLlamaProtocol,
} from "./defillama-client";

export const DEFILLAMA_PROVIDER = "DefiLlama";

/**
 * DefiLlama project slugs for the protocols the StableSave Vault uses. Their
 * pools get the vault's protocol id ("kamino", …) so vault strategies can find
 * them; every other project keeps its DefiLlama slug.
 */
export const DEFILLAMA_PROJECTS: Record<ProtocolId, string[]> = {
  kamino: ["kamino-lend"],
  marginfi: ["marginfi-lending", "marginfi"],
  drift: ["drift-trade", "drift-protocol", "drift"],
  save: ["save", "solend"],
};

const PROJECT_TO_VAULT_PROTOCOL = new Map<string, ProtocolId>(
  (Object.entries(DEFILLAMA_PROJECTS) as Array<[ProtocolId, string[]]>).flatMap(([id, slugs]) =>
    slugs.map((slug) => [slug, id] as const),
  ),
);

/** Symbols accepted as the plain stablecoin. USDT0 is Tether's official omnichain USDT. Bridged ".e" copies are not. */
export const STABLE_SYMBOLS: Record<StableAsset, string[]> = {
  USDC: ["USDC"],
  USDT: ["USDT", "USDT0", "USD₮0"],
};

/** Canonical Solana mints. Solana pools on a different mint (bridged copies) are skipped. */
export const SOLANA_STABLE_MINTS: Record<StableAsset, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export interface DefiLlamaProviderOptions {
  client?: DefiLlamaClient;
  /** Ignore small pools. */
  minTvlUsd?: number;
  /** Keep the largest N pools per stablecoin. */
  maxPerAsset?: number;
  /** Rates above this (decimal) are treated as anomalies and skipped. */
  maxApy?: number;
}

/**
 * Every single-asset USDC/USDT pool DefiLlama tracks, on every network, as
 * unrated opportunities. One provider, one /pools download.
 */
export class DefiLlamaMarketsProvider implements OpportunityProvider {
  readonly id = "defillama";
  readonly name = DEFILLAMA_PROVIDER;
  readonly mode = "live" as const;
  private readonly client: DefiLlamaClient;
  private readonly minTvlUsd: number;
  private readonly maxPerAsset: number;
  private readonly maxApy: number;

  constructor(options: DefiLlamaProviderOptions = {}) {
    this.client = options.client ?? getSharedDefiLlamaClient();
    this.minTvlUsd = options.minTvlUsd ?? 1_000_000;
    this.maxPerAsset = options.maxPerAsset ?? 60;
    this.maxApy = options.maxApy ?? 0.5;
  }

  async listOpportunities(): Promise<Opportunity[]> {
    let pools: DefiLlamaPool[];
    try {
      pools = await this.client.pools();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new LiveDataUnavailableError(this.id, `Live rates unavailable: ${reason}.`);
    }

    const selected = selectStablePools(pools, {
      minTvlUsd: this.minTvlUsd,
      maxPerAsset: this.maxPerAsset,
      maxApyPercent: this.maxApy * 100,
    });
    if (selected.length === 0) throw new LiveDataUnavailableError(this.id, "DefiLlama returned no USDC or USDT pools.");

    const [lendBorrow, protocols] = await Promise.all([this.client.lendBorrow(), this.client.protocols()]);
    const fetchedAt = new Date().toISOString();
    const usedIds = new Set<string>();
    return selected.map(({ pool, asset }) =>
      toOpportunity({
        pool,
        asset,
        lendBorrow: lendBorrow.get(pool.pool) ?? null,
        meta: protocols.get(pool.project) ?? null,
        fetchedAt,
        usedIds,
      }),
    );
  }
}

export interface SelectedPool {
  pool: DefiLlamaPool;
  asset: StableAsset;
}

export function selectStablePools(
  pools: readonly DefiLlamaPool[],
  { minTvlUsd, maxPerAsset, maxApyPercent }: { minTvlUsd: number; maxPerAsset: number; maxApyPercent: number },
): SelectedPool[] {
  const out: SelectedPool[] = [];
  for (const asset of ["USDC", "USDT"] as StableAsset[]) {
    const symbols = STABLE_SYMBOLS[asset];
    const matches = pools
      .filter((p) => {
        if (!symbols.includes(p.symbol.toUpperCase()) && !symbols.includes(p.symbol)) return false;
        if (p.exposure !== null && p.exposure !== "single") return false;
        if (p.outlier === true || p.apy === null || p.apy < 0 || p.apy > maxApyPercent) return false;
        if (p.tvlUsd < minTvlUsd) return false;
        if (p.chain.toLowerCase() === "solana" && p.underlyingTokens.length > 0 && !p.underlyingTokens.includes(SOLANA_STABLE_MINTS[asset])) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
    // The vault prices its strategy from these protocols' Solana pools, so keep them even when
    // bigger pools on other networks fill the top N.
    const vaultPools = matches.slice(maxPerAsset).filter((p) => p.chain.toLowerCase() === "solana" && PROJECT_TO_VAULT_PROTOCOL.has(p.project));
    out.push(...[...matches.slice(0, maxPerAsset), ...vaultPools].map((pool) => ({ pool, asset })));
  }
  return out;
}

/** DefiLlama protocol category → how StableSave describes and grades the strategy. */
function strategyFor(category: string | null): { type: StrategyType; complexity: "simple" | "moderate" | "complex" } {
  const c = (category ?? "").toLowerCase();
  if (["lending", "cdp", "liquid lending"].includes(c)) return { type: "lending", complexity: "simple" };
  if (c.includes("aggregator") || c.includes("curator") || c.includes("allocator") || c === "yield") {
    return { type: "curated-vault", complexity: "moderate" };
  }
  if (c.includes("insurance")) return { type: "insurance-fund", complexity: "complex" };
  return { type: "yield", complexity: "moderate" };
}

function describe(type: StrategyType, asset: StableAsset, protocol: string, market: string | null, network: string): string {
  const where = market ? `${protocol}'s ${market}` : protocol;
  switch (type) {
    case "lending":
      return `Your ${asset} is lent to borrowers through ${where} on ${network}. Borrowers post more collateral than they borrow and pay interest, which is passed on to you.`;
    case "curated-vault":
      return `Your ${asset} goes into ${where} on ${network}, a managed vault that moves funds between strategies or lending markets. Someone else decides the mix.`;
    case "insurance-fund":
      return `Your ${asset} sits in ${where} on ${network} and can be used to cover other people's losses in exchange for a share of fees.`;
    case "yield":
      return `Your ${asset} is deposited into ${where} on ${network}, which earns yield through its own strategy. Read how it works on the official site before depositing.`;
  }
}

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

function toOpportunity(input: {
  pool: DefiLlamaPool;
  asset: StableAsset;
  lendBorrow: DefiLlamaLendBorrow | null;
  meta: DefiLlamaProtocol | null;
  fetchedAt: string;
  usedIds: Set<string>;
}): Opportunity {
  const { pool, asset, lendBorrow, meta, fetchedAt, usedIds } = input;
  const vaultProtocol = PROJECT_TO_VAULT_PROTOCOL.get(pool.project);
  const curated = vaultProtocol ? PROTOCOLS[vaultProtocol] : null;
  const protocolId = vaultProtocol ?? pool.project;
  const protocolName = curated?.name ?? meta?.name ?? titleCase(pool.project);
  const network = networkIdFromName(pool.chain);
  const networkInfo = getNetwork(network, pool.chain);
  // The vault protocols' stablecoin pools are all plain lending (Drift's spot lending included).
  const strategy = vaultProtocol ? { type: "lending" as const, complexity: "simple" as const } : strategyFor(meta?.category ?? null);

  // DefiLlama reports rates in percent.
  const totalApy = (pool.apy ?? 0) / 100;
  const rewardApy = Math.max(0, (pool.apyReward ?? 0) / 100);
  const baseApy = pool.apyBase !== null ? pool.apyBase / 100 : Math.max(0, totalApy - rewardApy);

  // For lending pools DefiLlama's tvlUsd is supply minus borrows, i.e. what can be withdrawn now.
  const supplied = lendBorrow?.totalSupplyUsd ?? null;
  const borrowed = lendBorrow?.totalBorrowUsd ?? null;
  const utilization = supplied && supplied > 0 && borrowed !== null ? Math.min(1, Math.max(0, borrowed / supplied)) : null;
  const liquidityUsd = supplied !== null && borrowed !== null ? Math.max(0, supplied - borrowed) : pool.tvlUsd;
  const tvlUsd = supplied ?? pool.tvlUsd;

  const audits = meta ? (meta.auditLinks.length > 0 ? meta.auditLinks.length : meta.audits === "0" ? 0 : null) : null;
  const oracles = meta?.oracles ?? [];
  const officialUrl = curated?.officialUrl ?? meta?.url ?? null;

  const product = `${asset} ${strategy.type === "lending" ? "Lending" : strategy.type === "curated-vault" ? "Vault" : "Yield"}`;
  let id = `${protocolId}-${network}-${slugify(pool.poolMeta ?? "main")}-${asset.toLowerCase()}`;
  if (usedIds.has(id)) id = `${id}-${pool.pool.slice(0, 6).toLowerCase()}`;
  usedIds.add(id);

  const fees: FeeSchedule = {
    depositFeeBps: 0,
    withdrawalFeeBps: 0,
    performanceFeeBps: 0,
    estimatedNetworkFeeUsd: networkInfo.estimatedNetworkFeeUsd,
    refundableRentUsd: 0,
  };

  return {
    id,
    protocolId,
    protocolName,
    protocolLogo: meta?.logo ?? null,
    productName: product,
    marketName: pool.poolMeta ?? "Main pool",
    strategyType: strategy.type,
    description: describe(strategy.type, asset, protocolName, pool.poolMeta, networkInfo.name),
    network,
    networkName: networkInfo.name,
    asset,
    yield: {
      baseApy,
      rewardApy,
      totalApy,
      avgApy30d: pool.apyMean30d !== null ? pool.apyMean30d / 100 : null,
      apyChange7d: pool.apyPct7D !== null ? pool.apyPct7D / 100 : null,
    },
    tvlUsd,
    liquidityUsd,
    depositors: null,
    protocolTvlUsd: meta?.tvl ?? null,
    fees,
    risk: {
      launchedAt: meta?.listedAt ? new Date(meta.listedAt * 1000).toISOString().slice(0, 10) : null,
      audits,
      bugBountyUsd: null,
      upgradeAuthority: "unknown",
      openSource: null,
      strategyComplexity: strategy.complexity,
      usesLeverage: false,
      incidents: [],
      incidentsReviewed: false,
      apyHistory30d: [],
      apyVolatility: pool.sigma !== null ? pool.sigma / 100 : null,
      oracleSetup: oracles.length >= 2 ? "redundant" : oracles.length === 1 ? "single" : "unknown",
      oracles,
      utilization,
      withdrawalDelayHours: 0,
      topDepositorsShare: null,
      collateralConcentration: null,
      trackRecordDays: pool.count,
    },
    officialUrl,
    officialDomain: curated?.officialDomain ?? hostname(officialUrl),
    updatedAt: fetchedAt,
    provenance: {
      mode: "live",
      provider: DEFILLAMA_PROVIDER,
      fetchedAt,
      note: "Rates and liquidity from DefiLlama, which refreshes them about hourly. Network fees are StableSave estimates, and some risk inputs aren't verified yet.",
      sourceUrl: `https://defillama.com/yields/pool/${pool.pool}`,
      sourceId: pool.pool,
    },
  };
}

/** DefiLlama pool ids are UUIDs. Anything else is rejected before a request is made. */
export function isDefiLlamaPoolId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * DefiLlama's daily chart → the last `days` days of rates (decimals), one point
 * per calendar day, oldest first. Days without a usable rate are skipped.
 */
export function toRateHistory(points: readonly DefiLlamaChartPoint[], days = 90): RatePoint[] {
  const byDay = new Map<string, number>();
  for (const point of points) {
    const date = point.timestamp.slice(0, 10);
    if (point.apy === null || point.apy < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    byDay.set(date, point.apy / 100);
  }
  const sorted = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.slice(-days).map(([date, apy]) => ({ date, apy }));
}

/** Rate history for one DefiLlama pool. Returns [] when it's unavailable. */
export async function fetchRateHistory(
  poolId: string,
  { client = getSharedDefiLlamaClient(), days = 90 }: { client?: DefiLlamaClient; days?: number } = {},
): Promise<RatePoint[]> {
  if (!isDefiLlamaPoolId(poolId)) return [];
  return toRateHistory(await client.chart(poolId), days);
}
