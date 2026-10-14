import type { Benchmark } from "@stablesave/core";
import { Landmark } from "lucide-react";
import { formatEarnings, formatPercent } from "@/lib/format";

/** "For comparison" row above the options: what a no-crypto benchmark pays on the same amount. */
export function BenchmarkRow({ benchmark: b, amount }: { benchmark: Benchmark; amount: number }) {
  const month = monthLabel(b.asOf);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3 py-3 sm:gap-3.5 sm:px-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
        <Landmark className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold tracking-[-0.01em] text-fg">
          {b.name}
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">For comparison</span>
        </p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-fg-muted">
          No crypto risk ·{" "}
          {b.mode === "demo" ? (
            "demo figure"
          ) : (
            <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-fg">
              US Treasury, {month}
            </a>
          )}
        </p>
      </div>
      <div className="shrink-0 pr-1 text-right sm:pr-12">
        <p className="text-[17px] font-semibold tabular-nums tracking-[-0.02em] text-fg-muted">{formatPercent(b.rate)}</p>
        <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-fg-subtle">{amount > 0 ? `${formatEarnings(amount * b.rate)}/yr` : "—"}</p>
      </div>
    </div>
  );
}

export function monthLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
