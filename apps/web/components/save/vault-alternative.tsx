"use client";

import { PROTOCOLS, formatBpsAsPercent, type BlendedStrategy, type RiskProfile } from "@stablesave/core";
import { AllocationBar, AnimatedNumber, GradeBadge, ProtocolMark } from "@stablesave/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatEarnings } from "@/lib/format";

/** "Or split it" row: the StableSave Vault strategy for the chosen risk level. */
export function VaultAlternative({ blend, amount, profile }: { blend: BlendedStrategy; amount: number; profile: RiskProfile }) {
  const segments = blend.strategy.allocations.map((a) => ({
    id: a.protocolId,
    label: PROTOCOLS[a.protocolId].name,
    share: a.weightBps / 10_000,
  }));
  const allocationText = blend.strategy.allocations
    .map((a) => `${PROTOCOLS[a.protocolId].name} ${formatBpsAsPercent(a.weightBps)}`)
    .join(" · ");

  return (
    <Link
      href={`/vault/deposit?amount=${Math.round(amount)}&risk=${profile}`}
      className="group flex items-center gap-3.5 rounded-[20px] px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
    >
      <ProtocolMark protocolId="stablesave" name="S" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">Or split it with StableSave Vault</p>
        <p className="mt-0.5 truncate text-xs text-fg-muted">{allocationText}</p>
        <AllocationBar segments={segments} height={3} className="mt-2 max-w-[220px]" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-medium tabular-nums text-positive">
          <AnimatedNumber value={blend.estimate.netEarnings} format={formatEarnings} />
        </span>
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-fg-muted">
          {(blend.apy * 100).toFixed(2)}%
          <GradeBadge grade={blend.safety.display} size="sm" className="h-5 min-w-5 text-[10px]" />
        </span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
