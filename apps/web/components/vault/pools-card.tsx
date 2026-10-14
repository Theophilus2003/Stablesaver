"use client";

import { LIQUIDITY_BUFFER_BPS } from "@stablesave/client";
import { AllocationBar, Button, Card, PROTOCOL_COLORS } from "@stablesave/ui";
import { RefreshCw } from "lucide-react";
import { formatPercent, formatUsd } from "@/lib/format";
import type { OnchainBreakdown } from "@/lib/vault/portfolio";

const BUFFER = LIQUIDITY_BUFFER_BPS / 10_000;

/**
 * The whole vault, as read from the chain: what's kept liquid in the reserve
 * and what sits in each practice pool, with its rate and the interest paid.
 */
export function PoolsCard({ breakdown: b, onSync, busy }: { breakdown: OnchainBreakdown; onSync?: () => void; busy: boolean }) {
  const total = b.vaultTotal;
  const share = (value: number) => (total > 0 ? value / total : 0);
  const segments = [
    { id: "reserve", label: "Kept liquid", share: total > 0 ? share(b.reserve) : 1 },
    ...b.pools.map((p) => ({ id: p.protocolId, label: `${p.name} pool`, share: share(p.amount) })),
  ];
  const interest = b.pools.reduce((sum, p) => sum + p.interestPaid, 0);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium">Where the vault&apos;s money is</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            Whole vault, read from the chain · <span className="tabular-nums text-fg">{formatUsd(total, { decimals: 2 })}</span>
            {interest > 0 ? (
              <>
                {" "}
                · <span className="tabular-nums text-positive">{formatUsd(interest, { decimals: 2, sign: true })}</span> interest paid
              </>
            ) : null}
          </p>
        </div>
        {onSync ? (
          <Button variant="tonal" size="sm" onClick={onSync} disabled={busy}>
            <RefreshCw className={busy ? "animate-spin" : undefined} />
            Collect interest &amp; rebalance
          </Button>
        ) : null}
      </div>

      <AllocationBar segments={segments} className="mt-5" />

      <ul className="mt-4 divide-y divide-line text-[13px]">
        <li className="flex items-center gap-3 py-3">
          <span className="size-2 shrink-0 rounded-full bg-[#888]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">Kept liquid for withdrawals</p>
            <p className="text-fg-muted">In the vault reserve · target {formatPercent(BUFFER, 0)}</p>
          </div>
          <p className="tabular-nums text-fg">{formatUsd(b.reserve, { decimals: 2 })}</p>
        </li>
        {b.pools.map((p) => (
          <li key={p.protocolId} className="flex items-center gap-3 py-3">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS[p.protocolId] ?? "#888" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{p.name} practice pool</p>
              <p className="text-fg-muted">
                {formatPercent(p.apy)} practice rate · target {formatPercent((p.targetBps / 10_000) * (1 - BUFFER), 0)}
                {p.interestPaid > 0 ? ` · ${formatUsd(p.interestPaid, { decimals: 2 })} interest paid` : ""}
              </p>
            </div>
            <p className="tabular-nums text-fg">{formatUsd(p.amount, { decimals: 2 })}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-fg-subtle">
        Practice pools stand in for these protocols until direct integrations ship. Each holds real test tokens and pays a
        fixed practice rate from the vault&apos;s sponsor pot. Anyone can rebalance: it only moves money toward the on-chain
        strategy and always keeps {formatPercent(BUFFER, 0)} liquid.
      </p>
    </Card>
  );
}
