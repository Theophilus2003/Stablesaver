"use client";

import { INELIGIBLE_COPY, formatCompactUsd, formatPercent, getNetwork, type RankedOption } from "@stablesave/core";
import { GradeBadge, ProtocolMark, cn } from "@stablesave/ui";
import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatEarnings } from "@/lib/format";
import { networkBadge, protocolLogoUrls } from "@/lib/logos";

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
  const pool = /^main (pool|market)$/i.test(o.marketName) ? null : o.marketName;

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
      className="group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3.5 outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 sm:gap-3.5 sm:px-4"
    >
      <ProtocolMark
        protocolId={o.protocolId}
        name={o.protocolName}
        logoUrl={protocolLogoUrls(o.protocolId, o.protocolLogo)}
        network={networkBadge(network)}
        className={cn(!option.eligible && "opacity-60")}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={cn("truncate text-[15px] font-semibold tracking-[-0.01em]", option.eligible ? "text-fg" : "text-fg-muted")}>
            {o.protocolName}
          </span>
          {pool ? <span className="hidden truncate text-[13px] text-fg-subtle sm:inline">{pool}</span> : null}
          {recommended ? (
            <span className="shrink-0 self-center rounded-full bg-positive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-positive">
              Best fit
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 items-start gap-1.5 text-[13px] leading-[18px] text-fg-muted">
          <GradeBadge grade={o.safety.grade} size="xs" title={`Safety grade ${o.safety.display}`} />
          <span className="min-w-0 break-words">
            <span className="whitespace-nowrap">
              {network.name} · {formatCompactUsd(o.tvlUsd)}
            </span>
            {o.yield.rewardApy > 0 ? (
              <>
                {" "}
                <span className="whitespace-nowrap text-info">· incl. bonus</span>
              </>
            ) : null}
          </span>
        </div>
        {!option.eligible && option.ineligibleReason ? (
          <p className="mt-0.5 truncate text-xs text-fg-subtle">{INELIGIBLE_COPY[option.ineligibleReason]}</p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-[17px] font-semibold tabular-nums tracking-[-0.02em]", option.eligible ? "text-fg" : "text-fg-muted")}>
          {formatPercent(o.yield.totalApy)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[13px] font-semibold tabular-nums",
            option.estimate.principal === 0
              ? "text-fg-subtle"
              : net >= 0
                ? option.eligible
                  ? "text-positive"
                  : "text-positive/60"
                : "text-danger",
          )}
        >
          {formatEarnings(net)}/yr
        </p>
      </div>

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
          "flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg/40",
          pinned ? "bg-positive/15 text-positive" : "bg-surface-3 text-fg-muted hover:bg-line-strong hover:text-fg",
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
  );
}
