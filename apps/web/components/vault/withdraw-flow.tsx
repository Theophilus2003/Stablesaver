"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { formatCountdown, formatDuration, type MarketSnapshot } from "@stablesave/core";
import { Button, Card, Panel, Skeleton } from "@stablesave/ui";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { AmountField } from "@/components/save/amount-field";
import { useWalletDialog } from "@/components/wallet/wallet-providers";
import { formatAmountInput, formatUsd, parseAmount } from "@/lib/format";
import { describeTxError } from "@/lib/vault/onchain";
import { useVault } from "./use-vault";
import { PendingWithdrawalCard, TxProgress, VaultModeBanner, type TxPhase } from "./vault-parts";

export function WithdrawFlow({ snapshot, initialAmount }: { snapshot: MarketSnapshot; initialAmount?: number }) {
  const env = useEnvironment();
  const vault = useVault(snapshot.opportunities);
  const { connected } = useWallet();
  const { setOpen } = useWalletDialog();
  const p = vault.portfolio;
  const simulated = !env.vaultDeployed;

  const [amountText, setAmountText] = React.useState(() => formatAmountInput(String(initialAmount ?? 5_000)));
  const [phase, setPhase] = React.useState<TxPhase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [signature, setSignature] = React.useState<string>();
  const [result, setResult] = React.useState<{ instant: number; timelocked: number } | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!vault.ready) return <Skeleton className="h-96 rounded-[28px]" />;
  if (!p || !p.hasDeposits) {
    return (
      <Card className="p-6">
        <p className="text-sm text-fg-muted">{vault.error ?? "Nothing to withdraw yet."}</p>
        <Button asChild className="mt-4">
          <Link href="/vault/deposit">Make a deposit</Link>
        </Button>
      </Card>
    );
  }

  const requested = Math.min(parseAmount(amountText), p.balance);
  const available = p.instantAvailable;
  const instant = Math.min(requested, available);
  const remainder = Math.max(0, requested - instant);
  const large = remainder > 0.004;
  const blockedByPending = large && Boolean(p.pending);
  const timelock = p.limits.withdrawalTimelockSeconds;

  async function submit() {
    setError(null);
    if (!simulated && !connected) {
      setOpen(true);
      return;
    }
    try {
      setPhase("preparing");
      if (simulated) {
        await wait(450);
        setPhase("signing");
        await wait(500);
        setPhase("confirming");
      } else {
        setPhase("signing");
      }
      const r = await vault.withdraw(requested);
      if (simulated) await wait(500);
      setSignature(r.signature);
      setResult({ instant: r.instant ?? instant, timelocked: r.timelocked ?? remainder });
      setPhase("done");
    } catch (e) {
      setError(describeTxError(e));
      setPhase("error");
    }
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describeTxError(e));
    } finally {
      setBusy(false);
    }
  }

  const txBusy = phase === "preparing" || phase === "signing" || phase === "confirming";

  return (
    <div className="flex flex-col gap-5">
      {p.pending ? (
        <PendingWithdrawalCard
          pending={p.pending}
          timelockSeconds={timelock}
          busy={busy}
          onExecute={() => run(vault.execute)}
          onCancel={() => run(vault.cancel)}
        />
      ) : null}

      {phase === "done" && result ? (
        <Card className="p-6 sm:p-7">
          <div className="flex size-11 items-center justify-center rounded-full bg-positive/12 text-positive">
            <Check className="size-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">
            {result.instant > 0 ? `${formatUsd(result.instant, { decimals: 2 })} is on its way` : "Withdrawal requested"}
            {simulated ? " (simulated)" : ""}
          </h2>
          {result.timelocked > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              {formatUsd(result.timelocked, { decimals: 2 })} unlocks in {formatDuration(timelock)}. Come back to complete it.
            </p>
          ) : null}
          <div className="mt-5">
            <TxProgress phase="done" simulated={simulated} signature={signature} />
          </div>
          <div className="mt-6 flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/vault">Back to your StableSave</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("idle");
                setResult(null);
              }}
            >
              New withdrawal
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-7">
          <AmountField
            label="Withdraw"
            value={amountText}
            onChange={setAmountText}
            asset="USDC"
            quickAmounts={false}
            hint={
              <span className="flex items-center gap-3">
                <span>
                  Balance <span className="tabular-nums text-fg">{formatUsd(p.balance, { decimals: 2 })}</span>
                </span>
                <button
                  type="button"
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-fg-muted hover:text-fg"
                  onClick={() => setAmountText(formatAmountInput(String(Math.floor(p.balance * 100) / 100)))}
                >
                  Max
                </button>
              </span>
            }
          />

          <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-fg-muted">Available now</span>
            <span className="font-medium tabular-nums">{formatUsd(available, { decimals: 2 })}</span>
          </div>

          <AnimatePresence initial={false}>
            {large ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <Panel className="mt-4 border-warning/20 bg-warning/[0.05] p-5">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-warning" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-warning">Large withdrawal</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                    For security, larger withdrawals may be subject to a short timelock.
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <LargeStat label="Requested" value={formatUsd(requested, { decimals: 0 })} />
                    <LargeStat label="Available now" value={formatUsd(instant, { decimals: 0 })} />
                    <LargeStat label="Time remaining" value={formatCountdown(timelock)} hint="after you confirm" />
                  </dl>
                  {blockedByPending ? (
                    <p className="mt-3 text-xs text-warning">Finish or cancel your current timelocked withdrawal before requesting another.</p>
                  ) : null}
                </Panel>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {phase !== "idle" ? (
            <div className="mt-5">
              <TxProgress phase={phase} simulated={simulated} signature={signature} error={error} />
            </div>
          ) : error ? (
            <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>
          ) : null}

          <Button size="xl" className="mt-6 w-full" disabled={requested <= 0 || txBusy || (instant <= 0 && blockedByPending)} onClick={submit}>
            {!simulated && !connected
              ? "Connect wallet to withdraw"
              : large && !blockedByPending
                ? instant > 0
                  ? `Withdraw ${formatUsd(instant, { decimals: 0 })} now, request ${formatUsd(remainder, { decimals: 0 })}`
                  : `Request ${formatUsd(remainder, { decimals: 0 })}`
                : `Withdraw ${formatUsd(instant, { decimals: instant % 1 ? 2 : 0 })}`}
          </Button>
          <p className="mt-3 text-center text-xs text-fg-subtle">
            {simulated
              ? "Simulated: nothing is sent to your wallet."
              : `Instant limit: ${formatUsd(p.limits.largeWithdrawalThreshold, { decimals: 0 })} per ${formatDuration(p.limits.windowSeconds)}, enforced on-chain.`}
          </p>
        </Card>
      )}

      <VaultModeBanner />
    </div>
  );
}

function LargeStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-[11px] text-fg-subtle">{hint}</dd> : null}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function WithdrawHeader() {
  return (
    <div className="mb-6">
      <Link href="/vault" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Vault
      </Link>
      <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.035em]">Withdraw</h1>
      <p className="mt-1 text-sm text-fg-muted">Small amounts arrive right away. Larger ones wait a short timelock.</p>
    </div>
  );
}
