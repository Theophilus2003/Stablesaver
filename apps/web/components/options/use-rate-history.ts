"use client";

import type { Opportunity, RatePoint } from "@stablesave/core";
import * as React from "react";

export type RateHistoryState =
  | { status: "loading"; points: RatePoint[] }
  | { status: "ready"; points: RatePoint[] }
  | { status: "unavailable"; points: RatePoint[] };

/** Fetched histories, shared by every panel opened in this tab. */
const cache = new Map<string, Promise<RatePoint[]>>();

function load(poolId: string): Promise<RatePoint[]> {
  let pending = cache.get(poolId);
  if (!pending) {
    pending = fetch(`/api/rate-history/${encodeURIComponent(poolId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ points?: RatePoint[] }>) : { points: [] }))
      .then((body) => (Array.isArray(body.points) ? body.points : []))
      .catch(() => []);
    pending.then((points) => {
      if (points.length === 0) cache.delete(poolId);
    });
    cache.set(poolId, pending);
  }
  return pending;
}

/**
 * Daily rates for an option, oldest first, ending with today's rate so the
 * chart's end matches the headline number. Demo data ships its own history;
 * live pools are fetched on demand.
 */
export function useRateHistory(o: Opportunity): RateHistoryState {
  const shipped = o.rateHistory;
  const poolId = o.provenance.sourceId;
  const [fetched, setFetched] = React.useState<{ poolId: string; points: RatePoint[] } | null>(null);

  React.useEffect(() => {
    if (shipped?.length || !poolId) return;
    let cancelled = false;
    load(poolId).then((points) => {
      if (!cancelled) setFetched({ poolId, points });
    });
    return () => {
      cancelled = true;
    };
  }, [shipped, poolId]);

  return React.useMemo((): RateHistoryState => {
    if (shipped?.length) return { status: "ready", points: endWithToday(shipped, o.yield.totalApy, o.updatedAt) };
    if (!poolId) return { status: "unavailable", points: [] };
    if (!fetched || fetched.poolId !== poolId) return { status: "loading", points: [] };
    if (fetched.points.length < 2) return { status: "unavailable", points: [] };
    return { status: "ready", points: endWithToday(fetched.points, o.yield.totalApy, o.updatedAt) };
  }, [shipped, poolId, fetched, o.yield.totalApy, o.updatedAt]);
}

function endWithToday(points: readonly RatePoint[], apy: number, updatedAt: string): RatePoint[] {
  const today = updatedAt.slice(0, 10);
  const out = points.filter((p) => p.date <= today);
  if (out.at(-1)?.date === today) out[out.length - 1] = { date: today, apy };
  else out.push({ date: today, apy });
  return out;
}
