"use client";

import {
  ASSET_INFO,
  estimateEarnings,
  formatBpsAsPercent,
  formatCompactUsd,
  formatPercent,
  formatRelativeTime,
  getNetwork,
  isVaultProtocol,
  type FactorAssessment,
  type RatedOpportunity,
} from "@stablesave/core";
import { Badge, Button, Eyebrow, GradeBadge, ProtocolMark, StatusDot, cn } from "@stablesave/ui";
import { ArrowRight, ArrowUpRight, ChevronDown, CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import * as React from "react";
import { formatEarnings, formatNetworkFee, formatUsd } from "@/lib/format";

export interface OptionDetailProps {
  opportunity: RatedOpportunity;
  amount: number;
  /** Rendered as a page (true) or inside the drawer (false). */
  standalone?: boolean;
}

export function OptionDetail({ opportunity: o, amount, standalone = false }: OptionDetailProps) {
  const estimate = estimateEarnings(amount, o.yield.totalApy, o.fees);
  const demo = o.provenance.mode === "demo";
  const network = getNetwork(o.network, o.networkName);
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);

  return (
    <div className={cn("flex flex-col", standalone ? "gap-8" : "gap-7")}>
      {/* Heading */}
      <div className="flex items-start gap-3.5">
        <ProtocolMark protocolId={o.protocolId} name={o.protocolName} logoUrl={o.protocolLogo} network={network} size="lg" />
        <div className="min-w-0">
          <p className="text-[13px] text-fg-muted">{o.protocolName}</p>
          <h2 className={cn("font-semibold tracking-[-0.02em] text-fg", standalone ? "text-2xl" : "text-xl")}>
            {o.productName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge size="xs">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: network.color }} aria-hidden />
              {network.name}
            </Badge>
            <Badge size="xs">{o.marketName}</Badge>
            {demo ? (
              <Badge size="xs" tone="warning">
                <StatusDot tone="warning" />
                Demo data
              </Badge>
            ) : (
              <Badge size="xs" tone="positive">
                <StatusDot tone="positive" />
                Live
              </Badge>
            )}
          </div>
        </div>
      </div>

      {demo ? (
        <p className="-mt-2 rounded-2xl border border-warning/20 bg-warning/[0.06] px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
          {o.provenance.note ?? "Illustrative numbers for development."} Check the official app for current figures.
        </p>
      ) : (
        <p className="-mt-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
          {o.provenance.note}{" "}
          {o.provenance.sourceUrl ? (
            <a
              href={o.provenance.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg"
            >
              View on {o.provenance.provider}
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : null}
        </p>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-line bg-line">
        <div className="bg-surface-2 p-4">
          <p className="text-[13px] text-fg-muted">Current APY</p>
          <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {formatPercent(o.yield.totalApy)}
          </p>
          <p className="mt-2 text-xs text-fg-subtle tabular-nums">
            {formatPercent(o.yield.baseApy)} base
            {o.yield.rewardApy > 0 ? ` + ${formatPercent(o.yield.rewardApy)} rewards` : ""}
          </p>
        </div>
        <div className="bg-surface-2 p-4">
          <p className="text-[13px] text-fg-muted">Est. yearly earnings</p>
          <p
            className={cn(
              "mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
              amount <= 0 ? "text-fg-subtle" : estimate.netEarnings >= 0 ? "text-positive" : "text-danger",
            )}
          >
            {formatEarnings(estimate.netEarnings)}
          </p>
          <p className="mt-2 text-xs text-fg-subtle">
            {amount > 0 && estimate.netEarnings < 0
              ? `Fees cost more than ${formatUsd(amount, { decimals: 0 })} would earn here`
              : `on ${formatUsd(amount, { decimals: 0 })}, after fees`}
          </p>
        </div>
      </div>

      {/* Facts */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <Fact label="Safety grade">
          <span className="flex items-center gap-2">
            <GradeBadge grade={o.safety.display} size="sm" />
            {o.safety.label}
          </span>
        </Fact>
        <Fact label="Liquidity">{formatCompactUsd(o.liquidityUsd)} available</Fact>
        <Fact label="TVL">{formatCompactUsd(o.tvlUsd)}</Fact>
        <Fact label="Asset">
          {o.asset} <span className="text-fg-subtle">· {ASSET_INFO[o.asset].issuer}</span>
        </Fact>
        <Fact label="Network">{network.name}</Fact>
        <Fact label="Fees">
          {feeSummary(o)}
          <span className="block text-xs text-fg-subtle">
            ~{formatNetworkFee(o.fees.estimatedNetworkFeeUsd)} {network.name} network fees, in and out
          </span>
        </Fact>
        {o.depositors !== null ? <Fact label="Depositors">{o.depositors.toLocaleString("en-US")}</Fact> : null}
        <Fact label="Last updated">
          <span suppressHydrationWarning>{now ? formatRelativeTime(o.updatedAt, now) : "—"}</span>
          <span className="block text-xs text-fg-subtle">{demo ? "demo snapshot" : `via ${o.provenance.provider}`}</span>
        </Fact>
      </dl>

      <WhyThisGrade opportunity={o} />
      <WhereMoneyGoes opportunity={o} />
      <WhatCouldGoWrong opportunity={o} />

      {/* CTA */}
      <div className="flex flex-col gap-3">
        {o.officialUrl ? (
          <Button asChild size="lg" className="w-full">
            <a href={o.officialUrl} target="_blank" rel="noopener noreferrer">
              Deposit on official app
              <ArrowUpRight />
            </a>
          </Button>
        ) : o.provenance.sourceUrl ? (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <a href={o.provenance.sourceUrl} target="_blank" rel="noopener noreferrer">
              Find the official app on {o.provenance.provider}
              <ArrowUpRight />
            </a>
          </Button>
        ) : null}
        {o.asset === "USDC" && o.network === "solana" ? (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={`/vault/deposit?amount=${Math.round(amount)}`}>
              Use StableSave Vault instead
              <ArrowRight />
            </Link>
          </Button>
        ) : null}
        <p className="text-xs leading-relaxed text-fg-subtle">
          {o.officialUrl ? (
            <>
              Opens <span className="text-fg-muted">{o.officialDomain}</span>
              {isVaultProtocol(o.protocolId) ? "" : `, the site ${o.provenance.provider} lists for ${o.protocolName}`}. Check
              the address before you connect a wallet.{" "}
            </>
          ) : (
            <>We don&apos;t have a verified link for {o.protocolName} yet. </>
          )}
          StableSave doesn&apos;t control, operate or guarantee {o.protocolName}, and never holds funds you deposit there.
        </p>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-fg">{children}</dd>
    </div>
  );
}

function feeSummary(o: RatedOpportunity): string {
  const parts: string[] = [];
  parts.push(o.fees.depositFeeBps > 0 ? `${formatBpsAsPercent(o.fees.depositFeeBps)} deposit` : "No deposit fee");
  if (o.fees.withdrawalFeeBps > 0) parts.push(`${formatBpsAsPercent(o.fees.withdrawalFeeBps)} withdrawal`);
  if (o.fees.performanceFeeBps > 0) parts.push(`${formatBpsAsPercent(o.fees.performanceFeeBps)} of yield (included in rate)`);
  return parts.join(" · ");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Eyebrow className="mb-3">{children}</Eyebrow>;
}

function WhyThisGrade({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const [open, setOpen] = React.useState(false);
  const s = o.safety;
  return (
    <section>
      <SectionTitle>Why this grade</SectionTitle>
      <div className="rounded-[20px] border border-line bg-surface-2 p-4">
        <div className="flex items-start gap-3.5">
          <GradeBadge grade={s.display} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">
              {s.label} <span className="font-normal tabular-nums text-fg-subtle">· {s.score}/100</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.summary}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {s.reasons.slice(0, 4).map((reason) => (
            <li key={reason} className="flex gap-2.5 text-[13px] leading-relaxed text-fg-muted">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden />
              {reason}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-4 flex w-full items-center justify-between rounded-xl text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          {open ? "Hide" : "See"} all {s.factors.length} factors
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ul className="space-y-4 pt-4">
                {s.factors.map((f) => (
                  <FactorRow key={f.id} factor={f} />
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-subtle">
          StableSave safety assessment ({s.methodologyVersion}). Not a guarantee against loss.{" "}
          <Link href="/safety" className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted">
            How we rate
          </Link>
        </p>
      </div>
    </section>
  );
}

function FactorRow({ factor: f }: { factor: FactorAssessment }) {
  const color = f.impact === "positive" ? "bg-positive" : f.impact === "negative" ? "bg-danger" : "bg-warning";
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-fg">{f.label}</span>
        <span className="flex items-center gap-2 tabular-nums text-fg-subtle">
          {f.known ? null : (
            <span className="rounded-full border border-line px-1.5 py-px text-[10px] uppercase tracking-[0.08em]">Not verified</span>
          )}
          {f.score}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full opacity-80", color)} style={{ width: `${Math.max(4, f.score)}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{f.detail}</p>
    </li>
  );
}

function WhereMoneyGoes({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const destination =
    o.strategyType === "insurance-fund"
      ? "Insurance fund"
      : o.strategyType === "curated-vault"
        ? "Its strategies"
        : o.strategyType === "lending"
          ? "Borrowers"
          : "Its strategy";
  return (
    <section>
      <SectionTitle>Where your money goes</SectionTitle>
      <div className="flex items-center gap-2 text-[13px]">
        <FlowChip>Your wallet</FlowChip>
        <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" />
        <FlowChip strong>
          {o.protocolName} · {o.marketName}
        </FlowChip>
        <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" />
        <FlowChip>{destination}</FlowChip>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{o.description}</p>
    </section>
  );
}

function FlowChip({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "min-w-0 truncate rounded-full border px-2.5 py-1",
        strong ? "border-line-strong bg-surface-3 text-fg" : "border-line text-fg-muted",
      )}
    >
      {children}
    </span>
  );
}

function WhatCouldGoWrong({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const risks: Array<{ title: string; body: string }> = [
    {
      title: "Smart contract risk",
      body: `A bug in ${o.protocolName}'s code could lose deposits. ${
        o.risk.audits === null
          ? "We haven't verified its audit history yet."
          : o.risk.audits > 0
            ? `${o.risk.audits} audits lower that chance; they don't remove it.`
            : "It has no public audits."
      }`,
    },
    {
      title: "Stablecoin risk",
      body: `${o.asset} is designed to stay at $1, but it relies on ${ASSET_INFO[o.asset].issuer}. If it loses its peg, your balance loses value too.`,
    },
    {
      title: "Liquidity risk",
      body:
        o.risk.withdrawalDelayHours > 0
          ? `Withdrawals take about ${Math.round(o.risk.withdrawalDelayHours / 24)} days to unlock. You can't get your money back sooner.`
          : o.risk.utilization !== null
            ? `${formatPercent(o.risk.utilization, 0)} of deposits are lent out right now. If many people withdraw at once, you may have to wait.`
            : "Most deposits in a lending pool are lent out. If many people withdraw at once, you may have to wait.",
    },
    {
      title: "Yield changes",
      body: `Rates move with demand. ${formatPercent(o.yield.totalApy)} today isn't guaranteed${
        o.yield.rewardApy > 0 ? ", and token rewards can stop at any time" : ""
      }.`,
    },
  ];
  if (o.strategyType === "insurance-fund") {
    risks.splice(1, 0, {
      title: "Covering losses",
      body: "If traders leave bad debt, the insurance fund pays for it. That can directly reduce what you get back.",
    });
  }
  if (o.strategyType === "curated-vault") {
    risks.splice(1, 0, {
      title: "Curator decisions",
      body: "A curator chooses where the vault puts your money. A poor choice can expose you to markets you didn't pick.",
    });
  }
  if (o.strategyType === "yield") {
    risks.splice(1, 0, {
      title: "Strategy risk",
      body: `We haven't reviewed how ${o.protocolName} earns this yield. Read its docs: some strategies use leverage, trading or other tokens.`,
    });
  }
  if (o.network !== "solana") {
    risks.push({
      title: "Network risk",
      body: `This runs on ${getNetwork(o.network, o.networkName).name}. If your ${o.asset} is on another network, getting it there means a bridge or an exchange, which adds its own risk and fees.`,
    });
  }

  return (
    <section>
      <SectionTitle>What could go wrong?</SectionTitle>
      <ul className="divide-y divide-line rounded-[20px] border border-line">
        {risks.map((r) => (
          <li key={r.title} className="flex gap-3 p-4">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <div>
              <p className="text-sm font-medium text-fg">{r.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
