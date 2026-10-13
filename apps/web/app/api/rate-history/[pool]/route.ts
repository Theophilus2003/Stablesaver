import { fetchRateHistory, isDefiLlamaPoolId } from "@stablesave/protocol-adapters";
import { NextResponse } from "next/server";

/**
 * Daily rate history for one DefiLlama pool (last 90 days, decimals). Fetched
 * when someone opens an option, and cached at the edge for an hour.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ pool: string }> }) {
  const { pool } = await params;
  if (!isDefiLlamaPoolId(pool)) return NextResponse.json({ error: "Unknown pool" }, { status: 404 });
  const points = await fetchRateHistory(pool);
  return NextResponse.json(
    { points },
    { headers: { "cache-control": points.length > 0 ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } },
  );
}
