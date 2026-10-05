"use client";

import {
  getNetwork,
  sortOptions,
  type MarketSnapshot,
  type NetworkId,
  type RankedOption,
  type Recommendation,
  type SortMode,
} from "@stablesave/core";
import { Button, PillTabs } from "@stablesave/ui";
import { CircleAlert } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { formatUsd } from "@/lib/format";
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
  pinnedId,
  onOpen,
  onTogglePin,
}: {
  snapshot: MarketSnapshot;
  recommendation: Recommendation;
  pinnedId: string | null;
  onOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [sort, setSort] = React.useState<SortMode>("best");
  const [network, setNetwork] = React.useState<NetworkFilter>("all");
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  // Networks that have options for the chosen stablecoin, most options first.
  const networks = React.useMemo(() => {
    const counts = new Map<NetworkId, { name: string; color: string; count: number }>();
    for (const { opportunity: o } of recommendation.ranked) {
      const entry = counts.get(o.network);
      if (entry) entry.count += 1;
      else counts.set(o.network, { ...getNetwork(o.network, o.networkName), count: 1 });
    }
    return [...counts.entries()]
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [recommendation.ranked]);

  // A network with nothing for this stablecoin falls back to all networks.
  const activeNetwork: NetworkFilter = network !== "all" && networks.some((n) => n.id === network) ? network : "all";
  const filtered = recommendation.ranked.filter((r) => activeNetwork === "all" || r.opportunity.network === activeNetwork);
  const sorted = sortOptions(filtered, sort);
  const rows = sorted.slice(0, limit);
  const firstIneligible = sort === "best" ? rows.findIndex((r) => !r.eligible) : -1;
  const bestId = recommendation.best?.opportunity.id;

  const networkOptions: Array<{ value: NetworkFilter; label: React.ReactNode }> = [
    { value: "all", label: <ChipLabel name="All networks" count={recommendation.ranked.length} /> },
    ...networks.map((n) => ({
      value: n.id as NetworkFilter,
      label: <ChipLabel name={n.name} count={n.count} color={n.color} />,
    })),
  ];

  return (
    <section id="options" className="scroll-mt-24" aria-labelledby="options-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="options-title" className="text-[22px] font-semibold tracking-[-0.02em]">
          All options <span className="ml-1 tabular-nums text-fg-subtle">{filtered.length}</span>
        </h2>
        <p className="text-xs text-fg-muted">
          {recommendation.asset} · yearly estimates for {formatUsd(recommendation.amount, { decimals: 0 })}, after fees
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <PillTabs
          label="Sort options"
          value={sort}
          onValueChange={(v) => {
            setSort(v);
            setLimit(PAGE_SIZE);
          }}
          options={SORTS}
          className="-mx-1 shrink-0"
        />
        <PillTabs
          label="Network"
          value={activeNetwork}
          onValueChange={(v) => {
            setNetwork(v);
            setLimit(PAGE_SIZE);
          }}
          options={networkOptions}
          className="-mx-1 min-w-0 sm:[mask-image:linear-gradient(90deg,#000_94%,transparent)]"
        />
      </div>

      {snapshot.opportunities.length === 0 ? (
        <UnavailableState snapshot={snapshot} />
      ) : (
        <div className="mt-4 overflow-hidden rounded-[24px] border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_52px_76px_92px_36px] gap-x-4 border-b border-line px-5 py-3 text-xs text-fg-subtle md:grid">
            <span>Option</span>
            <span>Network · Liquidity</span>
            <span>Grade</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Per year</span>
            <span />
          </div>
          <motion.ul layout className="divide-y divide-line">
            {rows.map((row, i) => (
              <motion.li
                key={row.opportunity.id}
                layout="position"
                transition={{ type: "spring", stiffness: 500, damping: 45 }}
              >
                {i === firstIneligible && i > 0 ? (
                  <div className="bg-canvas/40 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
                    {dividerLabel(sorted.filter((r) => !r.eligible))}
                  </div>
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
            <p className="p-6 text-sm text-fg-muted">No {recommendation.asset} options on this network right now.</p>
          ) : null}
          {sorted.length > rows.length ? (
            <div className="border-t border-line p-3">
              <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE_SIZE * 2)}>
                Show more <span className="tabular-nums text-fg-subtle">{sorted.length - rows.length} left</span>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
        Rates change. Your return isn&apos;t guaranteed. Network fees are rough estimates for one deposit and one
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

function ChipLabel({ name, count, color }: { name: string; count: number; color?: string }) {
  return (
    <>
      {color ? <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden /> : null}
      <span className="whitespace-nowrap">{name}</span>
      <span className="tabular-nums opacity-60">{count}</span>
    </>
  );
}
