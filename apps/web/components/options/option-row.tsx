"use client";

import { INELIGIBLE_COPY, formatCompactUsd, formatPercent, getNetwork, type RankedOption } from "@stablesave/core";
import { GradeBadge, ProtocolMark, cn } from "@stablesave/ui";
import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatEarnings } from "@/lib/format";

export interface OptionRowProps {
  option: RankedOption;
  pinned: boolean;
  recommended: boolean;
  onOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export function OptionRow({ option, pinned, recommended, onOpen, onTogglePin }: OptionRowProps) {
  const o = option.opportunity;
  const net = option.estimate.netEarnings;
  const network = getNetwork(o.network, o.networkName);
  const meta = `${network.name} · ${formatCompactUsd(o.liquidityUsd)} liquidity`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(o.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(o.id);
        }
      }}
      aria-label={`${o.protocolName} ${o.productName} on ${network.name}, ${formatPercent(o.yield.totalApy)}, grade ${o.safety.display}`}
      className={cn(
        "group relative cursor-pointer outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2",
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4",
        "md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_52px_76px_92px_36px] md:gap-x-4 md:px-5",
        !option.eligible && "text-fg-muted",
      )}
    >
      {/* Name */}
      <div className="flex min-w-0 items-center gap-3">
        <ProtocolMark
          protocolId={o.protocolId}
          name={o.protocolName}
          logoUrl={o.protocolLogo}
          network={network}
          className={cn(!option.eligible && "opacity-60")}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("truncate text-[15px] font-medium", option.eligible ? "text-fg" : "text-fg-muted")}>
              {o.protocolName}
            </span>
            {recommended ? (
              <span className="hidden shrink-0 rounded-full bg-positive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-positive sm:inline">
                Best fit
              </span>
            ) : null}
          </div>
          <p className="truncate text-[13px] text-fg-muted">
            {o.productName} · {o.marketName}
          </p>
          <p className="mt-0.5 truncate text-xs text-fg-subtle md:hidden">{meta}</p>
          {!option.eligible && option.ineligibleReason ? (
            <p className="mt-0.5 truncate text-xs text-fg-subtle">{INELIGIBLE_COPY[option.ineligibleReason]}</p>
          ) : null}
        </div>
      </div>

      {/* Mobile: grade on the right of the name */}
      <div className="flex items-center justify-end md:hidden">
        <GradeBadge grade={o.safety.display} />
      </div>

      {/* Desktop columns */}
      <div className="hidden min-w-0 items-center gap-1.5 text-[13px] text-fg-muted md:flex">
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: network.color }} aria-hidden />
        <span className="truncate">{meta}</span>
      </div>
      <div className="hidden md:flex">
        <GradeBadge grade={o.safety.display} />
      </div>

      {/* Rate + earnings (mobile: bottom row) */}
      <div className="col-span-2 flex items-center justify-between gap-3 border-t border-line pt-3 md:contents md:border-0 md:pt-0">
        <div className="flex items-baseline gap-1.5 md:block md:text-right">
          <span className={cn("text-[17px] font-semibold tabular-nums tracking-tight md:text-[15px]", option.eligible ? "text-fg" : "text-fg-muted")}>
            {formatPercent(o.yield.totalApy)}
          </span>
          <span className="text-xs text-fg-subtle md:hidden">a year</span>
        </div>
        <div className="flex items-center gap-3 md:contents">
          <span
            className={cn(
              "text-[15px] font-medium tabular-nums md:text-right",
              option.estimate.principal === 0 ? "text-fg-subtle" : net >= 0 ? (option.eligible ? "text-positive" : "text-positive/60") : "text-danger",
            )}
          >
            {formatEarnings(net)}
            <span className="text-xs font-normal text-fg-subtle">/yr</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(o.id);
            }}
            aria-pressed={pinned}
            aria-label={pinned ? `Remove ${o.protocolName} from calculator` : `Show ${o.protocolName} in calculator`}
            title={pinned ? "Shown in calculator" : "Show in calculator"}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-full border transition-colors md:justify-self-end",
              pinned
                ? "border-positive/30 bg-positive/10 text-positive"
                : "border-line text-fg-muted hover:border-line-strong hover:bg-surface-3 hover:text-fg",
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={pinned ? "check" : "plus"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 30 }}
                className="flex"
              >
                {pinned ? <Check className="size-4" /> : <Plus className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </div>
  );
}
