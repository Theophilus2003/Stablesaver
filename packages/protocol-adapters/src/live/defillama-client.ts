/**
 * Minimal DefiLlama client for the free, keyless public APIs.
 *
 *   https://yields.llama.fi/pools        every yield pool (large: ~10–20 MB)
 *   https://yields.llama.fi/lendBorrow   supply/borrow totals for lending pools
 *   https://yields.llama.fi/chart/{id}   daily history for one pool
 *   https://api.llama.fi/protocols       protocol metadata (listing date, audits, oracles)
 *
 * Responses are validated field by field: anything malformed is dropped, never
 * guessed. Results are cached in memory (DefiLlama refreshes yields roughly
 * hourly) and concurrent callers share one in-flight request.
 *
 * Data: DefiLlama (https://defillama.com). Attribution is shown in the UI.
 */

export interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  poolMeta: string | null;
  exposure: string | null;
  stablecoin: boolean | null;
  outlier: boolean | null;
  /** Standard deviation of the pool's APY history, in percentage points. */
  sigma: number | null;
  underlyingTokens: string[];
}

export interface DefiLlamaLendBorrow {
  pool: string;
  totalSupplyUsd: number | null;
  totalBorrowUsd: number | null;
}

export interface DefiLlamaProtocol {
  slug: string;
  name: string;
  /** Unix seconds when DefiLlama listed the protocol. */
  listedAt: number | null;
  auditLinks: string[];
  /** DefiLlama's audit flag: "0" none, "1" partial, "2" audited, "3" … (kept raw). */
  audits: string | null;
  oracles: string[];
  url: string | null;
}

export interface DefiLlamaChartPoint {
  timestamp: string;
  apy: number | null;
  tvlUsd: number | null;
}

export class DefiLlamaRequestError extends Error {
  override readonly name = "DefiLlamaRequestError";
  constructor(
    readonly url: string,
    message: string,
  ) {
    super(message);
  }
}

export interface DefiLlamaClientOptions {
  fetch?: typeof globalThis.fetch;
  yieldsBaseUrl?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
  /** Cache lifetimes in ms. */
  ttl?: Partial<Record<"pools" | "lendBorrow" | "protocols" | "chart", number>>;
  now?: () => number;
}

const MINUTE = 60_000;
const DEFAULT_TTL = { pools: 10 * MINUTE, lendBorrow: 10 * MINUTE, protocols: 6 * 60 * MINUTE, chart: 60 * MINUTE };

interface CacheEntry<T> {
  at: number;
  value: Promise<T>;
}

export class DefiLlamaClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly yieldsBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly ttl: typeof DEFAULT_TTL;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(options: DefiLlamaClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.yieldsBaseUrl = (options.yieldsBaseUrl ?? "https://yields.llama.fi").replace(/\/$/, "");
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.llama.fi").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.ttl = { ...DEFAULT_TTL, ...options.ttl };
    this.now = options.now ?? Date.now;
  }

  /** Every pool DefiLlama tracks. Throws `DefiLlamaRequestError` on failure. */
  pools(): Promise<DefiLlamaPool[]> {
    return this.cached("pools", this.ttl.pools, async () => {
      const body = await this.getJson(`${this.yieldsBaseUrl}/pools`);
      const rows = isRecord(body) && Array.isArray(body.data) ? body.data : null;
      if (!rows) throw new DefiLlamaRequestError(`${this.yieldsBaseUrl}/pools`, "Unexpected response shape");
      return rows.flatMap((row) => {
        const pool = parsePool(row);
        return pool ? [pool] : [];
      });
    });
  }

  /** Supply/borrow totals keyed by pool id. Returns an empty map if unavailable. */
  lendBorrow(): Promise<Map<string, DefiLlamaLendBorrow>> {
    return this.cached("lendBorrow", this.ttl.lendBorrow, async () => {
      const map = new Map<string, DefiLlamaLendBorrow>();
      try {
        const body = await this.getJson(`${this.yieldsBaseUrl}/lendBorrow`);
        const rows = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.data) ? body.data : [];
        for (const row of rows) {
          if (!isRecord(row) || typeof row.pool !== "string") continue;
          map.set(row.pool, {
            pool: row.pool,
            totalSupplyUsd: num(row.totalSupplyUsd),
            totalBorrowUsd: num(row.totalBorrowUsd),
          });
        }
      } catch {
        /* optional enrichment */
      }
      return map;
    });
  }

  /** Protocol metadata keyed by slug. Returns an empty map if unavailable. */
  protocols(): Promise<Map<string, DefiLlamaProtocol>> {
    return this.cached("protocols", this.ttl.protocols, async () => {
      const map = new Map<string, DefiLlamaProtocol>();
      try {
        const body = await this.getJson(`${this.apiBaseUrl}/protocols`);
        if (Array.isArray(body)) {
          for (const row of body) {
            if (!isRecord(row) || typeof row.slug !== "string") continue;
            map.set(row.slug, {
              slug: row.slug,
              name: typeof row.name === "string" ? row.name : row.slug,
              listedAt: num(row.listedAt),
              auditLinks: strings(row.audit_links),
              audits: typeof row.audits === "string" ? row.audits : null,
              oracles: strings(row.oracles),
              url: typeof row.url === "string" ? row.url : null,
            });
          }
        }
      } catch {
        /* optional enrichment */
      }
      return map;
    });
  }

  /** Daily history for one pool, oldest first. Returns [] if unavailable. */
  chart(poolId: string): Promise<DefiLlamaChartPoint[]> {
    return this.cached(`chart:${poolId}`, this.ttl.chart, async () => {
      try {
        const body = await this.getJson(`${this.yieldsBaseUrl}/chart/${encodeURIComponent(poolId)}`);
        const rows = isRecord(body) && Array.isArray(body.data) ? body.data : [];
        return rows.flatMap((row): DefiLlamaChartPoint[] =>
          isRecord(row) && typeof row.timestamp === "string"
            ? [{ timestamp: row.timestamp, apy: num(row.apy), tvlUsd: num(row.tvlUsd) }]
            : [],
        );
      } catch {
        return [];
      }
    });
  }

  private cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key) as CacheEntry<T> | undefined;
    const t = this.now();
    if (hit && t - hit.at < ttl) return hit.value;
    const value = load();
    this.cache.set(key, { at: t, value });
    // Don't keep failures around: the next caller retries.
    value.catch(() => {
      if (this.cache.get(key)?.value === value) this.cache.delete(key);
    });
    return value;
  }

  private async getJson(url: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      } as RequestInit);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new DefiLlamaRequestError(url, `Couldn't reach DefiLlama (${reason})`);
    }
    if (!res.ok) throw new DefiLlamaRequestError(url, `DefiLlama responded ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new DefiLlamaRequestError(url, "DefiLlama returned invalid JSON");
    }
  }
}

function parsePool(row: unknown): DefiLlamaPool | null {
  if (!isRecord(row)) return null;
  const { pool, chain, project, symbol } = row;
  const tvlUsd = num(row.tvlUsd);
  if (typeof pool !== "string" || typeof chain !== "string" || typeof project !== "string" || typeof symbol !== "string") {
    return null;
  }
  if (tvlUsd === null) return null;
  return {
    pool,
    chain,
    project,
    symbol,
    tvlUsd,
    apy: num(row.apy),
    apyBase: num(row.apyBase),
    apyReward: num(row.apyReward),
    poolMeta: typeof row.poolMeta === "string" && row.poolMeta.trim() ? row.poolMeta.trim() : null,
    exposure: typeof row.exposure === "string" ? row.exposure : null,
    stablecoin: typeof row.stablecoin === "boolean" ? row.stablecoin : null,
    outlier: typeof row.outlier === "boolean" ? row.outlier : null,
    sigma: num(row.sigma),
    underlyingTokens: strings(row.underlyingTokens),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

let shared: DefiLlamaClient | undefined;

/**
 * One client per process so all four protocol sources share a single /pools
 * download. `STABLESAVE_DEFILLAMA_YIELDS_URL` / `STABLESAVE_DEFILLAMA_API_URL`
 * point it at a proxy or mirror.
 */
export function getSharedDefiLlamaClient(): DefiLlamaClient {
  const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  shared ??= new DefiLlamaClient({
    ...(env.STABLESAVE_DEFILLAMA_YIELDS_URL ? { yieldsBaseUrl: env.STABLESAVE_DEFILLAMA_YIELDS_URL } : {}),
    ...(env.STABLESAVE_DEFILLAMA_API_URL ? { apiBaseUrl: env.STABLESAVE_DEFILLAMA_API_URL } : {}),
  });
  return shared;
}
