"use client";

import {
  NETWORK_ORDER,
  NETWORKS,
  sortOptions,
  type MarketSnapshot,
  type NetworkId,
  type Recommendation,
  type SortMode,
} from "@stablesave/core";
import { PillTabs } from "@stablesave/ui";
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

  const filtered = recommendation.ranked.filter((r) => network === "all" || r.opportunity.network === network);
  const rows = sortOptions(filtered, sort);
  const firstIneligible = sort === "best" ? rows.findIndex((r) => !r.eligible) : -1;
  const bestId = recommendation.best?.opportunity.id;

  const networkOptions: Array<{ value: NetworkFilter; label: React.ReactNode; disabled?: boolean }> = [
    { value: "all", label: "All networks" },
    ...NETWORK_ORDER.map((id) => {
      const info = NETWORKS[id];
      const planned = info.status === "planned";
      return {
        value: id as NetworkFilter,
        disabled: planned,
        label: (
          <>
            {id === "solana" ? (
              <span className="size-1.5 rounded-full bg-gradient-to-br from-sol-purple to-sol-green" aria-hidden />
            ) : null}
            {info.name}
            {planned ? <span className="text-[10px] uppercase tracking-[0.08em] text-fg-subtle">Soon</span> : null}
          </>
        ),
      };
    }),
  ];

  return (
    <section id="options" className="scroll-mt-24" aria-labelledby="options-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="options-title" className="text-[22px] font-semibold tracking-[-0.02em]">
          All options <span className="ml-1 tabular-nums text-fg-subtle">{recommendation.ranked.length}</span>
        </h2>
        <p className="text-xs text-fg-muted">
          {recommendation.asset} · yearly estimates for {formatUsd(recommendation.amount, { decimals: 0 })}, after fees
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <PillTabs label="Sort options" value={sort} onValueChange={setSort} options={SORTS} className="-mx-1" />
        <PillTabs label="Network" value={network} onValueChange={setNetwork} options={networkOptions} className="-mx-1" />
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
                    Outside your risk setting
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
          {rows.length === 0 ? <p className="p-6 text-sm text-fg-muted">No options on this network yet.</p> : null}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
        Rates change. Your return isn&apos;t guaranteed. Grades are a StableSave safety assessment, not a guarantee against
        loss.
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
        We don&apos;t show placeholder rates in place of live ones. {snapshot.error ? snapshot.error : null}
      </p>
      {snapshot.adapters.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-xs text-fg-muted">
          {snapshot.adapters.map((a) => (
            <li key={a.protocolId}>
              <span className="text-fg">{a.name}</span> — {a.status === "ok" ? "ok" : a.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
