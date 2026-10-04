export {
  formatBpsAsPercent,
  formatCompactUsd,
  formatCountdown,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  formatUsd,
} from "@stablesave/core";

/** "+$503" style earnings figure; cents only for small values. */
export function formatEarnings(value: number): string {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 100 ? 2 : 0;
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (value < 0) return `−$${formatted}`;
  return `+$${formatted}`;
}

/** Amount input display: 10000 → "10,000", keeps a trailing "." while typing. */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  const fraction = rest.join("").slice(0, 2);
  const wholeFormatted = whole ? Number(whole.slice(0, 12)).toLocaleString("en-US") : "";
  if (cleaned.includes(".")) return `${wholeFormatted || "0"}.${fraction}`;
  return wholeFormatted;
}

export function parseAmount(display: string): number {
  const n = Number(display.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatNetworkFee(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}
