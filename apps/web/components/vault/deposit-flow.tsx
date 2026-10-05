"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  PROTOCOLS,
  RISK_PROFILE_IDS,
  RISK_PROFILES,
  blendStrategy,
  formatBpsAsPercent,
  formatDuration,
  type MarketSnapshot,
  type RiskProfile,
} from "@stablesave/core";
import { AllocationBar, AnimatedNumber, Badge, Button, Card, GradeBadge, cn } from "@stablesave/ui";
import { ArrowLeft, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { AmountField } from "@/components/save/amount-field";
import { useWalletDialog } from "@/components/wallet/wallet-providers";
import { formatAmountInput, formatEarnings, formatPercent, formatUsd, parseAmount } from "@/lib/format";
import { CLUSTER_LABEL } from "@/lib/env";
import { describeTxError } from "@/lib/vault/onchain";
import { useVault } from "./use-vault";
import { TxProgress, VaultModeBanner, allocationSegments, type TxPhase } from "./vault-parts";

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = { 1: "You have", 2: "Choose your risk", 3: "Review" };

export function DepositFlow({
  snapshot,
  initialAmount,
  initialProfile,
}: {
  snapshot: MarketSnapshot;
  initialAmount: number;
  initialProfile: RiskProfile;
}) {
  const env = useEnvironment();
  const router = useRouter();
  const vault = useVault(snapshot.opportunities);
  const { connected } = useWallet();
  const { setOpen } = useWalletDialog();

  const [step, setStep] = React.useState<Step>(1);
  const [amountText, setAmountText] = React.useState(() => formatAmountInput(String(initialAmount)));
  const [profile, setProfile] = React.useState<RiskProfile>(initialProfile);
  const [phase, setPhase] = React.useState<TxPhase>("idle");
  const [signature, setSignature] = React.useState<string>();
  const [error, setError] = React.useState<string | null>(null);

  const amount = parseAmount(amountText);
  const simulated = !env.vaultDeployed;
  const blend = React.useMemo(
    () => blendStrategy(vault.strategyFor(profile), snapshot.opportunities, amount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, snapshot.opportunities, amount, vault.availableProfiles.join()],
  );
  const limits = vault.limits;
  const balance = vault.walletBalance;
  const overBalance = !simulated && balance !== null && amount > balance;
  const amountValid = amount >= limits.minDeposit && !overBalance;
  const profileAvailable = vault.availableProfiles.includes(profile);

  async function submit() {
    setError(null);
    if (!simulated && !connected) {
      setOpen(true);
      return;
    }
    try {
      setPhase("preparing");
      if (simulated) {
        await wait(500);
        setPhase("signing");
        await wait(600);
        setPhase("confirming");
        await vault.deposit(amount, profile);
        await wait(600);
      } else {
        setPhase("signing");
        const pending = vault.deposit(amount, profile);
        // The wallet prompt resolves first; then the cluster confirms.
        setTimeout(() => setPhase((p) => (p === "signing" ? "confirming" : p)), 1500);
        const result = await pending;
        setSignature(result.signature);
      }
      setPhase("done");
    } catch (e) {
      setError(describeTxError(e));
      setPhase("error");
    }
  }

  const busy = phase === "preparing" || phase === "signing" || phase === "confirming";

  if (phase === "done") {
    return (
      <Card className="p-6 sm:p-8">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex size-12 items-center justify-center rounded-full bg-positive/12 text-positive">
          <Check className="size-6" />
        </motion.div>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
          {formatUsd(amount, { decimals: 0 })} deposited{simulated ? " (simulated)" : ""}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Split {blend?.strategy.allocations.map((a) => `${PROTOCOLS[a.protocolId].name} ${formatBpsAsPercent(a.weightBps)}`).join(", ")}.
          {simulated ? " Nothing left your wallet: this was a preview." : ""}
        </p>
        <div className="mt-6">
          <TxProgress phase="done" simulated={simulated} signature={signature} />
        </div>
        <Button size="lg" className="mt-8 w-full" onClick={() => router.push("/vault")}>
          View your StableSave
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <StepIndicator step={step} />

      <Card className="overflow-hidden p-6 sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {step === 1 ? (
              <div>
                <AmountField
                  value={amountText}
                  onChange={setAmountText}
                  asset="USDC"
                  hint={
                    simulated ? (
                      "Preview mode: any amount works, nothing leaves your wallet."
                    ) : balance === null ? (
                      connected ? "Checking your wallet…" : "Connect a wallet to see your balance."
                    ) : balance === 0 ? (
                      <span className="text-warning">
                        This wallet has none of the vault&apos;s token on {CLUSTER_LABEL[env.cluster]}.
                        {env.cluster === "devnet" ? " Run the devnet workflow with your wallet address to get test tokens." : ""}
                      </span>
                    ) : (
                      <span className={overBalance ? "text-warning" : undefined}>
                        In your wallet: {formatUsd(balance, { decimals: 2 })}
                        {overBalance ? " · that's less than this amount" : null}{" "}
                        {!overBalance ? (
                          <button
                            type="button"
                            className="ml-1 font-medium text-fg underline decoration-line-strong underline-offset-2"
                            onClick={() => setAmountText(formatAmountInput(String(Math.floor(balance * 100) / 100)))}
                          >
                            Use max
                          </button>
                        ) : null}
                      </span>
                    )
                  }
                />
                <Button size="lg" className="mt-7 w-full" disabled={!amountValid} onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <p className="text-[13px] text-fg-muted">How much risk are you okay with?</p>
                <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Risk level">
                  {RISK_PROFILE_IDS.map((id) => {
                    const b = blendStrategy(vault.strategyFor(id), snapshot.opportunities, amount);
                    const selected = id === profile;
                    const available = vault.availableProfiles.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!available}
                        onClick={() => setProfile(id)}
                        className={cn(
                          "flex flex-col gap-3 rounded-[20px] border p-4 text-left transition-colors disabled:opacity-40",
                          selected ? "border-fg/40 bg-surface-2" : "border-line hover:border-line-strong",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{RISK_PROFILES[id].label}</p>
                            <p className="mt-0.5 text-[13px] text-fg-muted">{RISK_PROFILES[id].description}</p>
                          </div>
                          <span
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-fg bg-fg text-canvas" : "border-line-strong",
                            )}
                          >
                            {selected ? <Check className="size-3" /> : null}
                          </span>
                        </div>
                        {b ? (
                          <div className="flex items-center gap-3">
                            <AllocationBar segments={allocationSegments(b.strategy.allocations)} height={4} className="max-w-[160px]" />
                            <span className="ml-auto text-[13px] tabular-nums text-fg-muted">{formatPercent(b.apy)}</span>
                            <GradeBadge grade={b.safety.display} size="sm" />
                          </div>
                        ) : null}
                        {!available ? <p className="text-xs text-fg-subtle">Not open on this cluster yet</p> : null}
                      </button>
                    );
                  })}
                </div>
                <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!profileAvailable} />
              </div>
            ) : null}

            {step === 3 && blend ? (
              <div>
                <dl className="flex flex-col divide-y divide-line">
                  <ReviewRow label="Deposit">{formatUsd(amount, { decimals: amount % 1 ? 2 : 0 })}</ReviewRow>
                  <ReviewRow label="Estimated APY">
                    <AnimatedNumber value={blend.apy * 100} format={(v) => `${v.toFixed(2)}%`} />
                  </ReviewRow>
                  <ReviewRow label="Estimated yearly earnings" hint="After fees">
                    <span className="text-positive">{formatEarnings(blend.estimate.netEarnings)}</span>
                  </ReviewRow>
                  <ReviewRow label="Safety grade" hint="Includes the vault's own contract risk">
                    <GradeBadge grade={blend.safety.display} size="sm" />
                  </ReviewRow>
                  <div className="py-4">
                    <dt className="text-sm text-fg-muted">Allocation</dt>
                    <dd className="mt-3 flex flex-col gap-2">
                      {blend.legs.map((leg) => (
                        <div key={leg.allocation.protocolId} className="flex items-center justify-between text-sm">
                          <span>{PROTOCOLS[leg.allocation.protocolId].name}</span>
                          <span className="tabular-nums text-fg-muted">
                            {formatBpsAsPercent(leg.allocation.weightBps)}
                            <span className="ml-2 text-fg-subtle">{formatUsd(leg.amount, { decimals: 0 })}</span>
                          </span>
                        </div>
                      ))}
                      <AllocationBar segments={allocationSegments(blend.strategy.allocations)} height={6} className="mt-1" />
                      {blend.strategy.source === "example" ? (
                        <p className="text-[11px] text-fg-subtle">Example allocation for development. Not a recommendation.</p>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                <p className="mt-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
                  Rates change and returns aren&apos;t guaranteed. Withdrawals over{" "}
                  {formatUsd(limits.largeWithdrawalThreshold, { decimals: 0 })} per {formatDuration(limits.windowSeconds)} wait{" "}
                  {formatDuration(limits.withdrawalTimelockSeconds)} for security.
                </p>

                {phase !== "idle" ? (
                  <div className="mt-5">
                    <TxProgress phase={phase} simulated={simulated} signature={signature} error={error} />
                  </div>
                ) : null}

                <Button size="xl" className="mt-6 w-full" disabled={busy} onClick={submit}>
                  {!simulated && !connected ? "Connect wallet to deposit" : `Deposit ${formatUsd(amount, { decimals: amount % 1 ? 2 : 0 })}`}
                </Button>
                <p className="mt-3 text-center text-xs text-fg-subtle">
                  {simulated ? "Simulated: no wallet confirmation, no real funds." : "Your wallet will ask you to confirm next."}
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={busy}
                  className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg disabled:opacity-40"
                >
                  <ArrowLeft className="size-4" /> Back
                </button>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </Card>

      <VaultModeBanner />
      <p className="text-center text-xs text-fg-subtle">
        Prefer to deposit directly? <Link href="/" className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted">Compare protocols</Link>
      </p>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Deposit steps">
      {([1, 2, 3] as Step[]).map((s) => (
        <li key={s} className="flex flex-1 flex-col gap-2">
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div className="h-full bg-fg" initial={false} animate={{ width: s <= step ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
          </div>
          <span className={cn("text-xs", s === step ? "text-fg" : "text-fg-subtle")} aria-current={s === step ? "step" : undefined}>
            {s}. {STEP_TITLES[s]}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StepNav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="mt-6 flex gap-2">
      <Button variant="secondary" size="lg" onClick={onBack} aria-label="Back">
        <ArrowLeft />
      </Button>
      <Button size="lg" className="flex-1" onClick={onNext} disabled={nextDisabled}>
        Continue
      </Button>
    </div>
  );
}

function ReviewRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <dt>
        <span className="text-sm text-fg-muted">{label}</span>
        {hint ? <span className="block text-xs text-fg-subtle">{hint}</span> : null}
      </dt>
      <dd className="text-[17px] font-medium tabular-nums">{children}</dd>
    </div>
  );
}

export function DepositHeader() {
  return (
    <div className="mb-6">
      <Link href="/vault" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Vault
      </Link>
      <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.035em]">Deposit USDC</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
        Three steps. Takes about a minute. <Badge size="xs">USDC only</Badge>
      </p>
    </div>
  );
}
