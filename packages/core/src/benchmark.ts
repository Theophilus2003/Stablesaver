import type { DataMode } from "./types";

/**
 * A no-crypto reference rate shown next to the options, so newcomers can see
 * what the extra yield is paying them for. US Treasury bills: what the US
 * government pays to borrow for up to a year.
 */
export interface Benchmark {
  name: string;
  /** Yearly rate as a decimal. */
  rate: number;
  /** Date the rate applies to (YYYY-MM-DD). */
  asOf: string;
  /** What the number is, in plain words. */
  description: string;
  source: string;
  sourceUrl: string;
  mode: DataMode;
}

/**
 * US Treasury "Average Interest Rates on U.S. Treasury Securities" (FiscalData),
 * filtered to Treasury Bills, newest month first.
 */
export const TREASURY_BILLS_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates" +
  "?fields=record_date,security_desc,avg_interest_rate_amt" +
  "&filter=security_desc:eq:Treasury%20Bills&sort=-record_date&page%5Bsize%5D=1";

export const TREASURY_BILLS_PAGE = "https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/";

/** Reads the newest Treasury Bills row from the FiscalData response. Null when it's missing or malformed. */
export function parseTreasuryBills(body: unknown): Benchmark | null {
  if (!body || typeof body !== "object") return null;
  const rows = (body as { data?: unknown }).data;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.security_desc !== "Treasury Bills") continue;
    const percent = Number(r.avg_interest_rate_amt);
    const date = typeof r.record_date === "string" ? r.record_date : "";
    if (!Number.isFinite(percent) || percent <= 0 || percent > 25 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    return {
      name: "US Treasury bills",
      rate: percent / 100,
      asOf: date,
      description: "Average rate on US government bills, published monthly by the US Treasury",
      source: "US Treasury FiscalData",
      sourceUrl: TREASURY_BILLS_PAGE,
      mode: "live",
    };
  }
  return null;
}

/** Shown in demo mode only, and labelled as demo data like the rest. */
export const DEMO_BENCHMARK: Benchmark = {
  name: "US Treasury bills",
  rate: 0.04,
  asOf: "2026-01-31",
  description: "Demo figure, not a live rate",
  source: "StableSave demo fixtures",
  sourceUrl: TREASURY_BILLS_PAGE,
  mode: "demo",
};
