"use client";

import { PROTOCOLS, formatCountdown, formatDuration, type BlendedStrategy, type StrategyAllocation } from "@stablesave/core";
import { AllocationBar, AllocationLegend, Badge, Button, GradeBadge, Panel, StatusDot, cn } from "@stablesave/ui";
import { Check, CircleAlert, Clock, ExternalLink, FlaskConical, LoaderCircle, Lock } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { CLUSTER_LABEL, explorerTxUrl } from "@/lib/env";
import { formatUsd } from "@/lib/format";
import type { PendingWithdrawal } from "@/lib/vault/portfolio";

export function allocationSegments(allocations: StrategyAllocation[]) {
  return allocations.map((a) => ({ id: a.protocolId, label: PROTOCOLS[a.protocolId].name, share: a.weightBps / 10_000 }));
}

/** Says plainly whether this is a simulation or real chain state. */
export function VaultModeBanner({ className }: { className?: string }) {
  const { vaultDeployed, cluster, vaultProgramId } = useEnvironment();
  if (vaultDeployed) {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-2xl border border-info/20 bg-info/[0.06] px-4 py-3 text-[13px] leading-relaxed", className)}>
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-to-br from-sol-purple to-sol-green" aria-hidden />
        <p className="text-fg-muted">
          <span className="text-fg">Solana {CLUSTER_LABEL[cluster]}.</span> Transactions are real on this cluster
          {cluster !== "mainnet-beta" ? " (test tokens only)" : ""}. Program{" "}
          <span className="font-mono text-xs text-fg">{vaultProgramId?.slice(0, 4)}…{vaultProgramId?.slice(-4)}</span>.
          {cluster !== "mainnet-beta" ? (
            <>
              {" "}
              Set your wallet to <span className="text-fg">{CLUSTER_LABEL[cluster]}</span> too, or it will try the transaction on mainnet.
            </>
          ) : null}
        </p>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl border border-warning/20 bg-warning/[0.06] px-4 py-3 text-[13px] leading-relaxed", className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="text-fg-muted">
        <span className="text-fg">Simulated preview.</span> The StableSave Vault isn&apos;t deployed on{" "}
        {CLUSTER_LABEL[cluster]} yet, so balances and transactions here are simulated in your browser. No wallet
        signature, no real funds.
      </p>
    </div>
  );
}

export function StrategySummary({ blend, compact = false }: { blend: BlendedStrategy; compact?: boolean }) {
  const segments = allocationSegments(blend.strategy.allocations);
  return (
    <div>
      <AllocationBar segments={segments} height={compact ? 6 : 8} />
      <AllocationLegend segments={segments} className="mt-4" />
      {blend.strategy.source === "example" ? (
        <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">Example allocation for development. Not a recommendation.</p>
      ) : null}
    </div>
  );
}

export function ProfileStats({ blend }: { blend: BlendedStrategy }) {
  return (
    <div className="flex items-center gap-2 text-[13px] tabular-nums text-fg-muted">
      <span className="font-medium text-fg">{(blend.apy * 100).toFixed(2)}%</span> est. APY
      <GradeBadge grade={blend.safety.display} size="sm" />
    </div>
  );
}

export type TxPhase = "idle" | "preparing" | "signing" | "confirming" | "done" | "error";

const PHASES: Array<{ id: Exclude<TxPhase, "idle" | "done" | "error">; label: string; simulatedLabel: string }> = [
  { id: "preparing", label: "Preparing transaction", simulatedLabel: "Preparing (simulated)" },
  { id: "signing", label: "Confirm in your wallet", simulatedLabel: "Skipping wallet: simulated" },
  { id: "confirming", label: "Confirming on Solana", simulatedLabel: "Recording in this browser" },
];

export function TxProgress({
  phase,
  simulated,
  signature,
  error,
}: {
  phase: TxPhase;
  simulated: boolean;
  signature?: string;
  error?: string | null;
}) {
  const { cluster } = useEnvironment();
  const order = ["preparing", "signing", "confirming", "done"];
  const current = order.indexOf(phase === "error" ? "confirming" : phase);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {PHASES.map((p, i) => {
        const state = phase === "error" && i === Math.max(0, current) ? "error" : i < current || phase === "done" ? "done" : i === current ? "active" : "todo";
        return (
          <div key={p.id} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border",
                state === "done" && "border-positive/30 bg-positive/10 text-positive",
                state === "active" && "border-line-strong text-fg",
                state === "todo" && "border-line text-fg-subtle",
                state === "error" && "border-danger/30 bg-danger/10 text-danger",
              )}
            >
              {state === "done" ? (
                <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }}>
                  <Check className="size-3.5" />
                </motion.span>
              ) : state === "active" ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : state === "error" ? (
                <CircleAlert className="size-3.5" />
              ) : (
                <span className="size-1 rounded-full bg-current" />
              )}
            </span>
            <span className={cn(state === "todo" ? "text-fg-subtle" : "text-fg")}>{simulated ? p.simulatedLabel : p.label}</span>
          </div>
        );
      })}
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p> : null}
      {signature ? (
        <a
          href={explorerTxUrl(signature, cluster)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg"
        >
          View on Solana Explorer <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

export function useCountdown(target: number | null) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return target ? Math.max(0, Math.ceil((target - now) / 1000)) : 0;
}

export function PendingWithdrawalCard({
  pending,
  timelockSeconds,
  onExecute,
  onCancel,
  busy,
}: {
  pending: PendingWithdrawal;
  timelockSeconds: number;
  onExecute: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const remaining = useCountdown(pending.unlockAt);
  const total = Math.max(1, (pending.unlockAt - pending.requestedAt) / 1000 || timelockSeconds);
  const progress = 1 - remaining / total;
  const ready = remaining === 0;

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-fg-muted" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-muted">Timelocked withdrawal</span>
        </div>
        {ready ? (
          <Badge tone="positive" size="xs">
            <StatusDot tone="positive" /> Ready
          </Badge>
        ) : (
          <Badge size="xs">
            <Clock className="size-3" /> Waiting
          </Badge>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[13px] text-fg-muted">Requested</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatUsd(pending.amount, { decimals: 2 })}</p>
        </div>
        <div>
          <p className="text-[13px] text-fg-muted">Time remaining</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{ready ? "0:00" : formatCountdown(remaining)}</p>
        </div>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full bg-fg/70"
          initial={false}
          animate={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
        Priced when you complete it, so it keeps earning until then. Timelock: {formatDuration(timelockSeconds)}.
      </p>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" disabled={!ready || busy} onClick={onExecute}>
          {busy ? <LoaderCircle className="animate-spin" /> : null}
          Complete withdrawal
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
