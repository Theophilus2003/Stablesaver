import { DEMO_BENCHMARK, TREASURY_BILLS_URL, parseTreasuryBills, type Benchmark } from "@stablesave/core";
import { getDataMode } from "../env";

/**
 * The US Treasury bill reference rate, cached for a day. Null when it can't be
 * loaded: the UI then leaves the comparison out rather than showing a guess.
 */
export async function getBenchmark(): Promise<Benchmark | null> {
  if (getDataMode() === "demo") return DEMO_BENCHMARK;
  try {
    const res = await fetch(TREASURY_BILLS_URL, { next: { revalidate: 24 * 60 * 60 }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    return parseTreasuryBills(await res.json());
  } catch {
    return null;
  }
}
