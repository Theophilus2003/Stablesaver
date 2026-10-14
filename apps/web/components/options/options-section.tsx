"use client";

import {
  getNetwork,
  sortOptions,
  type Benchmark,
  type MarketSnapshot,
  type NetworkId,
  type NetworkInfo,
  type RankedOption,
  type Recommendation,
  type SortMode,
} from "@stablesave/core";
import { Button, NetworkIcon, cn } from "@stablesave/ui";
import { CircleAlert } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { formatUsd } from "@/lib/format";
import { networkBadge } from "@/lib/logos";
import { BenchmarkRow } from "./benchmark-row";
import { OptionRow } from "./option-row";

const SORTS: Array<{ value: SortMode; label: string }> = [
  { value: "best", label: "Best for you" },
  { value: "rate", label: "Highest rate" },
  { value: "safest", label: "Safest" },
  { value: "popular", label: "Most popular" },
];

type NetworkFilter = "all" | NetworkId;

/** Rows shown before "Show more". */
const PAGE_SIZE = 12;

export function OptionsSection({
  snapshot,
  recommendation,
  benchmark = null,
  pinnedId,
  onOpen,
  onTogglePin,
}: {
  snapshot: MarketSnapshot;
  recommendation: Recommendation;
  benchmark?: Benchmark | null;
  pinnedId: string | null;
  onOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [sort, setSort] = React.useState<SortMode>("best");
  const [network, setNetwork] = React.useState<NetworkFilter>("all");
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  // Networks that have options for the chosen stablecoin, most options first.
  const networks = React.useMemo(() => {
    const counts = new Map<NetworkId, NetworkInfo & { count: number }>();
    for (const { opportunity: o } of recommendation.ranked) {
      const entry = counts.get(o.network);
      if (entry) entry.count += 1;
      else counts.set(o.network, { ...getNetwork(o.network, o.networkName), count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [recommendation.ranked]);

  // A network with nothing for this stablecoin falls back to all networks.
  const activeNetwork: NetworkFilter = network !== "all" && networks.some((n) => n.id === network) ? network : "all";
  const filtered = recommendation.ranked.filter((r) => activeNetwork === "all" || r.opportunity.network === activeNetwork);
  const sorted = sortOptions(filtered, sort);
  const rows = sorted.slice(0, limit);
  const firstIneligible = sort === "best" ? rows.findIndex((r) => !r.eligible) : -1;
  const bestId = recommendation.best?.opportunity.id;

  return (
    <section id="options" className="scroll-mt-24" aria-labelledby="options-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="options-title" className="text-[22px] font-semibold tracking-[-0.02em]">
          All options <span className="ml-1 tabular-nums text-fg-subtle">{filtered.length}</span>
        </h2>
        <SortControl
          value={sort}
          onChange={(v) => {
            setSort(v);
            setLimit(PAGE_SIZE);
          }}
        />
      </div>

      <NetworkChips
        networks={networks}
        total={recommendation.ranked.length}
        value={activeNetwork}
        onChange={(v) => {
          setNetwork(v);
          setLimit(PAGE_SIZE);
        }}
      />

      {benchmark && snapshot.opportunities.length > 0 ? <BenchmarkRow benchmark={benchmark} amount={recommendation.amount} /> : null}

      {snapshot.opportunities.length === 0 ? (
        <UnavailableState snapshot={snapshot} />
      ) : (
        <div className="mt-4 rounded-[28px] bg-surface p-2">
          <motion.ul layout>
            {rows.map((row, i) => (
              <motion.li
                key={row.opportunity.id}
                layout="position"
                transition={{ type: "spring", stiffness: 500, damping: 45 }}
              >
                {i === firstIneligible && i > 0 ? (
                  <div className="mx-3 mt-2 border-t border-line px-1 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle sm:mx-4">
                    {dividerLabel(sorted.filter((r) => !r.eligible))}
                  </div>
                ) : i > 0 ? (
                  <div className="mx-3 h-px bg-line sm:mx-4" aria-hidden />
                ) : null}
                <OptionRow
                  option={row}
                  pinned={pinnedId === row.opportunity.id}
                  recommended={row.opportunity.id === bestId}
                  onOpen={onOpen}
                  onTogglePin={onTogglePin}
                />
              </motion.li>
            ))}
          </motion.ul>
          {rows.length === 0 ? (
            <p className="p-5 text-sm text-fg-muted">No {recommendation.asset} options on this network right now.</p>
          ) : null}
          {sorted.length > rows.length ? (
            <div className="mx-3 mt-1 border-t border-line pt-2 sm:mx-4">
              <Button variant="ghost" className="w-full rounded-full" onClick={() => setLimit((l) => l + PAGE_SIZE * 2)}>
                Show more <span className="tabular-nums text-fg-subtle">{sorted.length - rows.length} left</span>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
        Yearly estimates for {formatUsd(recommendation.amount, { decimals: 0 })} of {recommendation.asset}, after network
        fees. Rates change. Your return isn&apos;t guaranteed. Network fees are rough estimates for one deposit and one
        withdrawal. Grades are a StableSave safety assessment, not a guarantee against loss.
        {snapshot.mode === "live" ? (
          <>
            {" "}
            Rates, deposits and liquidity from{" "}
            <a href="https://defillama.com/yields" target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted">
              DefiLlama
            </a>
            .
          </>
        ) : null}
      </p>
    </section>
  );
}

function UnavailableState({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <div className="mt-4 rounded-[24px] border border-line bg-surface p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CircleAlert className="size-4 text-warning" />
        Market data isn&apos;t available right now
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        We don&apos;t show placeholder rates in place of live ones. Try again in a minute.{" "}
        {snapshot.error ? snapshot.error : null}
      </p>
      {snapshot.adapters.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-xs text-fg-muted">
          {snapshot.adapters.map((a) => (
            <li key={a.id}>
              <span className="text-fg">{a.name}</span> — {a.status === "ok" ? "ok" : a.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Heading above the options that don't fit, matching why they don't. */
function dividerLabel(unfit: readonly RankedOption[]): string {
  const byGrade = unfit.filter((r) => r.ineligibleReason === "grade").length;
  if (byGrade === unfit.length) return "Outside your risk setting";
  if (byGrade === 0) return "Not a fit for this amount";
  return "Not a fit right now";
}

function SortControl({ value, onChange }: { value: SortMode; onChange: (value: SortMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Sort options"
      className="scrollbar-none -mx-1 flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-1 sm:mx-0"
    >
      {SORTS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg/40",
              selected ? "bg-brand/15 font-semibold text-brand" : "text-fg-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function NetworkChips({
  networks,
  total,
  value,
  onChange,
}: {
  networks: ReadonlyArray<NetworkInfo & { count: number }>;
  total: number;
  value: NetworkFilter;
  onChange: (value: NetworkFilter) => void;
}) {
  const chips: Array<{ value: NetworkFilter; name: string; count: number; network?: NetworkInfo }> = [
    { value: "all", name: "All networks", count: total },
    ...networks.map((n) => ({ value: n.id as NetworkFilter, name: n.name, count: n.count, network: n })),
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Network"
      className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(90deg,#000_88%,transparent)] sm:-mx-1 sm:px-1"
    >
      {chips.map((chip) => {
        const selected = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg/40",
              selected ? "bg-brand text-on-brand shadow-[0_6px_20px_-8px_rgb(61_220_151/0.6)]" : "bg-surface-2 text-fg hover:bg-surface-3",
              chip.network && "pl-2.5",
            )}
          >
            {chip.network ? <NetworkIcon network={networkBadge(chip.network)} className="size-5" /> : null}
            <span className="whitespace-nowrap">{chip.name}</span>
            {chip.value !== "all" ? (
              <span className={cn("text-xs font-medium tabular-nums", selected ? "text-on-brand/60" : "text-fg-subtle")}>
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
