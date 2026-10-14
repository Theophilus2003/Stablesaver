import { checkWithdrawal, formatCompactUsd, formatPercent, type Opportunity, type WithdrawStatus } from "@stablesave/core";
import { cn } from "@stablesave/ui";
import { CircleCheck, CircleHelp, Clock, TriangleAlert, type LucideIcon } from "lucide-react";

const TONE: Record<WithdrawStatus, { icon: LucideIcon; className: string }> = {
  ready: { icon: CircleCheck, className: "text-positive" },
  likely: { icon: CircleCheck, className: "text-positive" },
  tight: { icon: TriangleAlert, className: "text-warning" },
  wait: { icon: Clock, className: "text-warning" },
  unknown: { icon: CircleHelp, className: "text-fg-subtle" },
};

/** Full answer with a free-vs-lent-out bar, for the option detail panel. */
export function WithdrawCheckCard({ opportunity, amount }: { opportunity: Opportunity; amount: number }) {
  const c = checkWithdrawal(opportunity, amount);
  const { icon: Icon, className } = TONE[c.status];
  const u = c.utilization;
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", className)} aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-fg">{c.answer}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{c.detail}</p>
        </div>
      </div>
      {u !== null && c.availableUsd !== null ? (
        <div className="mt-4">
          <div
            role="img"
            aria-label={`${formatPercent(1 - u, 0)} free to withdraw, ${formatPercent(u, 0)} lent out`}
            className="flex h-2 overflow-hidden rounded-full bg-surface-3"
          >
            <div className="rounded-full bg-positive" style={{ width: `${Math.max(2, (1 - u) * 100)}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs tabular-nums text-fg-muted">
            <span>
              Free now · <span className="text-fg">{formatCompactUsd(c.availableUsd)}</span>
            </span>
            <span>Lent out · {formatPercent(u, 0)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One-line answer for the earnings card. Nothing when the data source doesn't report it. */
export function WithdrawHint({ opportunity, amount, className }: { opportunity: Opportunity; amount: number; className?: string }) {
  const c = checkWithdrawal(opportunity, amount);
  if (c.status === "unknown") return null;
  const { icon: Icon, className: tone } = TONE[c.status];
  const days = Math.max(1, Math.round(opportunity.risk.withdrawalDelayHours / 24));
  const label =
    c.status === "ready"
      ? "Withdraw anytime"
      : c.status === "likely"
        ? "Withdraw today: probably"
        : c.status === "tight"
          ? "Withdrawals may queue"
          : `Withdrawals take ~${days} ${days === 1 ? "day" : "days"}`;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-fg-muted", className)} title={c.detail}>
      <Icon className={cn("size-3.5", tone)} aria-hidden />
      {label}
    </span>
  );
}
