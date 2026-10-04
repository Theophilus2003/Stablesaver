/** Display helpers shared by the web app and API. */

export function formatUsd(
  value: number,
  options: { decimals?: number; sign?: boolean } = {},
): string {
  const decimals = options.decimals ?? (Math.abs(value) >= 1000 ? 0 : 2);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
  if (options.sign) return `${value < 0 ? "−" : "+"}${formatted}`;
  return value < 0 ? `−${formatted}` : formatted;
}

/** $412.5M, $1.2B, $950K */
export function formatCompactUsd(value: number): string {
  const abs = Math.abs(value);
  const units: Array<[number, string]> = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const scaled = value / size;
      return `$${scaled.toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return `$${value.toFixed(0)}`;
}

/** 0.0515 → "5.15%" */
export function formatPercent(decimal: number, digits = 2): string {
  return `${(decimal * 100).toFixed(digits)}%`;
}

export function formatBpsAsPercent(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

/** "just now", "4m ago", "2h ago", "3d ago" */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** "27:42" or "1:03:09" */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = totalSeconds / 3600;
  if (hours < 48) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
  return `${Math.round(hours / 24)} days`;
}
