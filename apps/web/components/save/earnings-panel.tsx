"use client";

import { RISK_PROFILES, type RankedOption, type RiskProfile } from "@stablesave/core";
import { AnimatedNumber, Badge, GradeBadge, Panel, ProtocolMark, cn } from "@stablesave/ui";
import { ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatEarnings, formatNetworkFee } from "@/lib/format";

export interface EarningsPanelProps {
  option: RankedOption | null;
  amount: number;
  profile: RiskProfile;
  pinned: boolean;
  onOpen: (id: string) => void;
  onUnpin: () => void;
  /** No market data at all (e.g. the live source is down). */
  unavailable?: boolean;
}

export function EarningsPanel({ option, amount, profile, pinned, onOpen, onUnpin, unavailable = false }: EarningsPanelProps) {
  const o = option?.opportunity;
  const net = option ? option.estimate.netEarnings : 0;
  const apy = o ? o.yield.totalApy : 0;
  const empty = amount <= 0;

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="whitespace-nowrap text-[13px] text-fg-muted">You could earn in a year</span>
          <div
            className={cn(
              "mt-2 text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[52px]",
              empty || !o ? "text-fg-subtle" : net >= 0 ? "text-positive" : "text-danger",
            )}
            aria-live="polite"
          >
            <AnimatedNumber value={empty || !o ? 0 : net} format={formatEarnings} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-fg-muted">
            {o ? (
              <>
                <span>
                  at{" "}
                  <AnimatedNumber
                    value={apy * 100}
                    format={(v) => `${v.toFixed(2)}%`}
                    className="font-medium tabular-nums text-fg"
                  />{" "}
                  a year
                </span>
                <Badge size="xs" tone="neutral" title="Estimate = amount × current rate − fees. Rates change.">
                  Estimated
                </Badge>
              </>
            ) : unavailable ? (
              "Rates unavailable right now"
            ) : (
              "No option fits this setting"
            )}
          </p>
        </div>

        {o ? (
          <button
            type="button"
            onClick={() => onOpen(o.id)}
            className="group -mr-1.5 flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2 text-[15px] font-medium transition-colors hover:bg-surface-3"
            aria-label={`See details for ${o.protocolName} ${o.productName}`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={o.protocolId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <ProtocolMark protocolId={o.protocolId} name={o.protocolName} size="sm" />
                {o.protocolName}
              </motion.span>
            </AnimatePresence>
            <ChevronRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : null}
      </div>

      {o ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px]">
            <GradeBadge grade={o.safety.display} size="sm" />
            <span className="font-medium text-fg">{o.safety.label}</span>
            <span className="text-fg-subtle" aria-hidden>
              ·
            </span>
            <span className="text-fg-muted">
              After ~{formatNetworkFee(option!.estimate.totalFees)} in {option!.estimate.depositFee + option!.estimate.withdrawalFee > 0 ? "fees" : "network fees"}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs">
            <span className="min-w-0 truncate text-fg-muted">
              {o.productName} · {o.marketName}
            </span>
            {pinned ? (
              <button
                type="button"
                onClick={onUnpin}
                className="inline-flex shrink-0 items-center gap-1 rounded-full text-fg-muted transition-colors hover:text-fg"
              >
                Your pick
                <X className="size-3.5" />
              </button>
            ) : (
              <span className="shrink-0 text-fg-subtle">Best fit for “{RISK_PROFILES[profile].label}”</span>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          {unavailable
            ? "We couldn't load live rates, so there's nothing to estimate. We don't fill the gap with made-up numbers. Try again in a minute."
            : empty
              ? "Enter an amount to see estimates."
              : "Nothing matches this risk level for this amount. Try a different risk setting or a smaller amount."}
        </p>
      )}
    </Panel>
  );
}
