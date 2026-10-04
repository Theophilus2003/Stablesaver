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
