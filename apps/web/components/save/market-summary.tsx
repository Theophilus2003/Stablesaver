"use client";

import { formatPercent, formatRelativeTime, type MarketSnapshot, type StableAsset } from "@stablesave/core";
import { StatusDot } from "@stablesave/ui";
import * as React from "react";

export function MarketSummaryStrip({
  snapshot,
  asset,
  onOpen,
}: {
  snapshot: MarketSnapshot;
  asset: StableAsset;
  onOpen: (id: string) => void;
}) {
  const best = snapshot.summary.bestGradeA[asset];
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const demo = snapshot.mode === "demo";
  const unavailable = snapshot.opportunities.length === 0;

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[24px] border border-line bg-surface sm:grid-cols-3">
      <button
        type="button"
        disabled={!best}
        onClick={() => best && onOpen(best.opportunityId)}
        className="col-span-2 flex flex-col gap-1 p-5 text-left transition-colors enabled:hover:bg-surface-2 sm:col-span-1"
      >
        <span className="text-[13px] text-fg-muted">Best grade-A {asset} today</span>
        <span className="text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums text-fg">
          {best ? formatPercent(best.apy) : "—"}
        </span>
        <span className="text-xs text-fg-subtle">{best ? `on ${best.protocolName}` : "No grade-A option right now"}</span>
      </button>
      <div className="flex flex-col gap-1 border-t border-line p-5 sm:border-l sm:border-t-0">
        <span className="text-[13px] text-fg-muted">Options</span>
        <span className="text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">
          {snapshot.summary.optionCount}
        </span>
        <span className="text-xs text-fg-subtle">across {snapshot.summary.protocolCount} supported apps</span>
      </div>
      <div className="flex flex-col gap-1 border-l border-t border-line p-5 sm:border-t-0">
        <span className="text-[13px] text-fg-muted">Updated</span>
        <span className="text-[26px] font-semibold leading-tight tracking-[-0.03em]" suppressHydrationWarning>
          {now && !unavailable ? formatRelativeTime(snapshot.generatedAt, now) : "—"}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <StatusDot tone={unavailable ? "danger" : demo ? "warning" : "positive"} pulse={!demo && !unavailable} />
          {unavailable ? "Couldn't load rates" : demo ? "Demo snapshot" : "Live · DefiLlama"}
        </span>
      </div>
    </div>
  );
}
