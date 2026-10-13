"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  EXAMPLE_VAULT_STRATEGIES,
  RISK_PROFILE_IDS,
  RISK_PROFILES,
  blendStrategy,
  formatDuration,
  type MarketSnapshot,
} from "@stablesave/core";
import {
  AllocationBar,
  AllocationLegend,
  AnimatedNumber,
  Badge,
  Button,
  Card,
  Eyebrow,
  GradeBadge,
  ProtocolMark,
  Skeleton,
} from "@stablesave/ui";
import { ArrowDownToLine, ArrowUpFromLine, Lock, PauseCircle, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { ConnectButton } from "@/components/wallet/connect-button";
import { useWalletDialog } from "@/components/wallet/wallet-providers";
import { formatEarnings, formatPercent, formatUsd } from "@/lib/format";
import { protocolLogoUrls } from "@/lib/logos";
import { EarningsChart } from "./earnings-chart";
import { useVault } from "./use-vault";
import { PendingWithdrawalCard, StrategySummary, VaultModeBanner, allocationSegments } from "./vault-parts";

export function VaultHome({ snapshot }: { snapshot: MarketSnapshot }) {
  const env = useEnvironment();
  const { connected } = useWallet();
  const [previewing, setPreviewing] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const showDashboard = mounted && (env.vaultDeployed ? connected : connected || previewing);

  return (
    <div className="mx-auto max-w-[880px] px-4 pt-10 sm:px-6 sm:pt-14">
      {showDashboard ? <Dashboard snapshot={snapshot} /> : <VaultIntro snapshot={snapshot} onPreview={() => setPreviewing(true)} />}
    </div>
  );
}

function VaultIntro({ snapshot, onPreview }: { snapshot: MarketSnapshot; onPreview: () => void }) {
  const env = useEnvironment();
  const { setOpen } = useWalletDialog();

  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto max-w-[560px] text-center">
        <Eyebrow>StableSave Vault</Eyebrow>
        <h1 className="mt-3 text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] text-balance sm:text-[52px]">
          One deposit, spread across Solana apps
        </h1>
        <p className="mx-auto mt-4 max-w-[440px] text-[15px] leading-relaxed text-fg-muted">
          Deposit USDC once. The vault splits it across established protocols based on how much risk you&apos;re okay
          with.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button size="lg" onClick={() => setOpen(true)}>
            Connect Solana wallet
          </Button>
          {!env.vaultDeployed ? (
            <Button size="lg" variant="secondary" onClick={onPreview}>
              Preview the dashboard
            </Button>
          ) : null}
        </div>
      </div>

      <VaultModeBanner className="mx-auto w-full max-w-[640px]" />

      <section>
        <h2 className="text-[15px] font-medium">Pick a strategy when you deposit</h2>
        {snapshot.opportunities.length === 0 ? (
          <p className="mt-3 rounded-[20px] border border-line p-5 text-sm text-fg-muted">
            Market rates couldn&apos;t be loaded right now, so we can&apos;t estimate the strategies. Try again in a minute.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {RISK_PROFILE_IDS.map((profile) => {
            const blend = blendStrategy(EXAMPLE_VAULT_STRATEGIES[profile], snapshot.opportunities, 10_000);
            if (!blend) return null;
            return (
              <Card key={profile} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{RISK_PROFILES[profile].label}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{RISK_PROFILES[profile].description}</p>
                  </div>
                  <GradeBadge grade={blend.safety.display} />
                </div>
                <div>
                  <p className="text-[26px] font-semibold tracking-[-0.03em] tabular-nums">{formatPercent(blend.apy)}</p>
                  <p className="text-xs text-fg-subtle">estimated APY · {formatEarnings(blend.estimate.netEarnings)}/yr on $10k</p>
                </div>
                <StrategySummary blend={blend} compact />
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "You stay in control",
            body: "Only your wallet can withdraw your share. StableSave can't move it for you.",
          },
          {
            icon: Lock,
            title: "Limits and timelocks",
            body: "Larger withdrawals wait a short timelock, enforced by the program itself.",
          },
          {
            icon: PauseCircle,
            title: "Emergency pause",
            body: "If something looks wrong, deposits and withdrawals can be paused while it's checked.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-[24px] border border-line p-5">
            <item.icon className="size-5 text-fg-muted" />
            <p className="mt-3 text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{item.body}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-xs leading-relaxed text-fg-subtle">
        The vault adds its own smart-contract risk on top of each protocol&apos;s. It isn&apos;t audited yet. Not a bank,
        not insured.
      </p>
    </div>
  );
}

function Dashboard({ snapshot }: { snapshot: MarketSnapshot }) {
  const vault = useVault(snapshot.opportunities);
  const env = useEnvironment();
  const { connected } = useWallet();
  const [busy, setBusy] = React.useState(false);
  const p = vault.portfolio;

  if (!vault.ready) return <DashboardSkeleton />;

  if (!p) {
    return (
      <div className="flex flex-col gap-4">
        <VaultModeBanner />
        <Card className="p-6 text-sm text-fg-muted">{vault.error ?? "Market data isn't available, so we can't value the vault right now."}</Card>
      </div>
    );
  }

  const segments = allocationSegments(p.allocations);
  const amountsById = Object.fromEntries(p.positions.map((pos) => [pos.protocolId, formatUsd(pos.amount, { decimals: 2 })]));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Your StableSave</h1>
            <Badge size="xs" tone={p.source === "simulated" ? "warning" : "info"}>
              {p.source === "simulated" ? "Simulated" : "On-chain"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {RISK_PROFILES[p.profile].label} strategy
            {p.source === "simulated" && !connected ? " · wallet not connected" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/vault/deposit?risk=${p.profile}`}>
              <ArrowDownToLine />
              Deposit
            </Link>
          </Button>
          {p.hasDeposits ? (
            <Button asChild variant="secondary">
              <Link href="/vault/withdraw">
                <ArrowUpFromLine />
                Withdraw
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              <ArrowUpFromLine />
              Withdraw
            </Button>
          )}
        </div>
      </div>

      <VaultModeBanner />

      <Card className="grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="bg-surface p-6">
          <p className="text-[13px] text-fg-muted">Total balance</p>
          <p className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            <AnimatedNumber value={p.balance} format={(v) => formatUsd(v, { decimals: 2 })} />
          </p>
        </div>
        <div className="bg-surface p-6">
          <p className="text-[13px] text-fg-muted">Earned</p>
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-positive">
            <AnimatedNumber value={p.earned} format={(v) => formatUsd(v, { decimals: 2, sign: true })} />
          </p>
        </div>
        <div className="bg-surface p-6">
          <p className="text-[13px] text-fg-muted">Current estimated APY</p>
          <p className="mt-2 flex items-center gap-2 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {formatPercent(p.apy)}
            <GradeBadge grade={p.grade} size="sm" />
          </p>
        </div>
      </Card>

      {p.undeployed && p.source === "onchain" ? (
        <p className="rounded-2xl border border-line px-4 py-3 text-[13px] text-fg-muted">
          Funds currently sit in the vault reserve. Allocation into protocols arrives with the allocator release; the APY
          shown is the strategy&apos;s target, not what the reserve earns today.
        </p>
      ) : null}

      {p.pending ? (
        <PendingWithdrawalCard
          pending={p.pending}
          timelockSeconds={p.limits.withdrawalTimelockSeconds}
          busy={busy}
          onExecute={() => run(vault.execute)}
          onCancel={() => run(vault.cancel)}
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="min-w-0 p-6">
          <h2 className="text-[15px] font-medium">Your allocation</h2>
          <AllocationBar segments={segments} className="mt-5" />
          <AllocationLegend segments={segments} className="mt-5" />
          {p.source === "simulated" ? (
            <p className="mt-4 text-[11px] leading-relaxed text-fg-subtle">Example allocation. Not a recommendation.</p>
          ) : null}
        </Card>
        <Card className="min-w-0 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-[15px] font-medium">Earnings over time</h2>
            {p.source === "simulated" ? <span className="text-xs text-fg-subtle">Simulated at today&apos;s estimated rate</span> : null}
          </div>
          <EarningsChart points={p.history} className="mt-4" />
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-[15px] font-medium">Your positions</h2>
          <span className="text-xs text-fg-subtle">{p.source === "onchain" && p.undeployed ? "Target split" : "By protocol"}</span>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {p.positions.map((pos) => (
            <li key={pos.protocolId} className="flex items-center gap-3 px-6 py-4">
              <ProtocolMark protocolId={pos.protocolId} name={pos.name} logoUrl={protocolLogoUrls(pos.protocolId, null)} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{pos.name}</p>
                <p className="truncate text-[13px] text-fg-muted">
                  USDC · {pos.marketName} · {(pos.weightBps / 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-medium tabular-nums">{amountsById[pos.protocolId]}</p>
                <p className="text-[13px] tabular-nums text-fg-muted">{formatPercent(pos.apy, 1)} APY</p>
              </div>
              <GradeBadge grade={pos.grade} className="ml-1" />
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-subtle">
        <span>
          Instant withdrawals up to {formatUsd(p.limits.largeWithdrawalThreshold, { decimals: 0 })} per{" "}
          {formatDuration(p.limits.windowSeconds)}; larger amounts wait {formatDuration(p.limits.withdrawalTimelockSeconds)}.
        </span>
        {vault.mode === "simulated" ? (
          <button type="button" onClick={vault.reset} className="inline-flex items-center gap-1.5 hover:text-fg-muted">
            <RotateCcw className="size-3.5" /> Reset simulation
          </button>
        ) : null}
      </div>

      {env.vaultDeployed && !connected ? <ConnectButton size="lg" /> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-28 w-full rounded-[28px]" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 rounded-[28px]" />
        <Skeleton className="h-64 rounded-[28px]" />
      </div>
    </div>
  );
}
