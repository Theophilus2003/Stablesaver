import type { Opportunity } from "@stablesave/core";

/**
 * Deterministic pseudo-random series so demo numbers stay stable between
 * reloads and server/client renders.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 30 daily APY observations around `mean` with roughly `sd` standard deviation,
 * ending exactly at `mean` (today's rate).
 */
export function apySeries(key: string, mean: number, sd: number, days = 30): number[] {
  const rand = mulberry32(hashString(key));
  const values: number[] = [];
  let drift = 0;
  for (let i = 0; i < days - 1; i++) {
    // Box–Muller normal sample, smoothed into a gentle random walk.
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    drift = drift * 0.6 + z * sd * 0.8;
    values.push(Math.max(0, mean + drift));
  }
  values.push(mean);
  return values;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Adds what the detail view shows for a pool: 90 days of rates (the last 30
 * are the opportunity's own `apyHistory30d`), the 30-day average, the 7-day
 * change and how long it has been running. Demo data only.
 */
export function withDemoHistory(o: Opportunity, now: Date = new Date()): Opportunity {
  const recent = o.risk.apyHistory30d;
  if (recent.length < 8) return o;
  const mean = recent.reduce((sum, v) => sum + v, 0) / recent.length;
  const sd = Math.sqrt(recent.reduce((sum, v) => sum + (v - mean) ** 2, 0) / recent.length) || 0.002;
  const values = [...apySeries(`${o.id}:older`, recent[0]!, sd, 60), ...recent];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rateHistory = values.map((apy, i) => ({
    date: new Date(today - (values.length - 1 - i) * DAY_MS).toISOString().slice(0, 10),
    apy,
  }));
  const launched = o.risk.launchedAt ? Date.parse(o.risk.launchedAt) : Number.NaN;
  return {
    ...o,
    rateHistory,
    yield: {
      ...o.yield,
      avgApy30d: mean,
      apyChange7d: recent[recent.length - 1]! - recent[recent.length - 8]!,
    },
    risk: {
      ...o.risk,
      trackRecordDays: Number.isFinite(launched) ? Math.max(0, Math.floor((today - launched) / DAY_MS)) : null,
    },
  };
}
