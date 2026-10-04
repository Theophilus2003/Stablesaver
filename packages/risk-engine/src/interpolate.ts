/** Piecewise-linear interpolation over sorted [x, y] points, clamped at both ends. */
export function interpolate(x: number, points: ReadonlyArray<readonly [number, number]>): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** Interpolate on log10(x); handy for TVL and liquidity, which span orders of magnitude. */
export function interpolateLog(x: number, points: ReadonlyArray<readonly [number, number]>): number {
  return interpolate(
    Math.log10(Math.max(1, x)),
    points.map(([px, py]) => [Math.log10(px), py] as const),
  );
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
