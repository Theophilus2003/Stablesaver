"use client";

import {
  estimateEarnings,
  formatBpsAsPercent,
  formatCompactUsd,
  formatPercent,
  formatRelativeTime,
  getNetwork,
  type FactorAssessment,
  type Grade,
  type RatedOpportunity,
  type RatePoint,
  type RiskFactorId,
  type StableAsset,
  type StrategyType,
} from "@stablesave/core";
import { Badge, Button, ProtocolMark, Skeleton, StatusDot, cn } from "@stablesave/ui";
import { ArrowRight, ArrowUpRight, CircleHelp, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { formatEarnings, formatNetworkFee } from "@/lib/format";
import { RateChart } from "./rate-chart";
import { useRateHistory, type RateHistoryState } from "./use-rate-history";

export interface OptionDetailProps {
  opportunity: RatedOpportunity;
  amount: number;
  /** Rendered as a page (true) or inside the drawer (false). The drawer shows the header itself. */
  standalone?: boolean;
}

export function OptionDetail({ opportunity: o, amount, standalone = false }: OptionDetailProps) {
  const history = useRateHistory(o);
  return (
    <div className="flex flex-col gap-9">
      {standalone ? <OptionHeader opportunity={o} titleAs="h1" /> : null}
      {o.provenance.mode === "demo" ? (
        <p className="rounded-2xl border border-warning/20 bg-warning/[0.06] px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
          {o.provenance.note ?? "Illustrative numbers for development."} Check the official app for current figures.
        </p>
      ) : null}
      <RateSection opportunity={o} history={history} />
      <EarningsSection opportunity={o} amount={amount} />
      <InterestSource opportunity={o} />
      <RiskSection opportunity={o} />
      <DepositSteps opportunity={o} />
      <Disclaimer opportunity={o} />
      <QuickFacts opportunity={o} history={history} />
      <DepositCta opportunity={o} amount={amount} />
    </div>
  );
}

/* ------------------------------------------------------------------ header */

export function OptionHeader({
  opportunity: o,
  titleAs: Title = "h2",
}: {
  opportunity: RatedOpportunity;
  titleAs?: React.ElementType;
}) {
  const network = getNetwork(o.network, o.networkName);
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <ProtocolMark protocolId={o.protocolId} name={o.protocolName} logoUrl={o.protocolLogo} network={network} size="lg" />
      <div className="min-w-0">
        <Title className="truncate text-xl font-semibold tracking-[-0.02em] text-fg">{o.protocolName}</Title>
        <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">
          {poolName(o)} · {o.asset} on the {network.name} network
        </p>
        {o.provenance.mode === "demo" ? (
          <Badge size="xs" tone="warning" className="mt-1.5">
            <StatusDot tone="warning" />
            Demo data
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- rate chart */

type Range = "1M" | "3M";
const RANGE_DAYS: Record<Range, number> = { "1M": 30, "3M": 90 };

function RateSection({ opportunity: o, history }: { opportunity: RatedOpportunity; history: RateHistoryState }) {
  const [range, setRange] = React.useState<Range>("1M");
  const [active, setActive] = React.useState<number | null>(null);
  const hasLong = history.points.length > RANGE_DAYS["1M"] + 2;
  const shown = history.points.slice(-(RANGE_DAYS[hasLong ? range : "1M"] + 1));
  const point = active !== null ? shown[active] : undefined;
  const change = o.yield.apyChange7d ?? changeOver(history.points, 7);

  const values = shown.map((p) => p.apy);
  const low = values.length ? Math.min(...values) : null;
  const high = values.length ? Math.max(...values) : null;
  const span = hasLong && range === "3M" ? "3 months" : "month";

  return (
    <section aria-label="Rate">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <InfoLabel
            label={point ? `Yearly rate on ${formatDay(point.date)}` : "Yearly rate today"}
            help="What you'd earn over a year if this rate held, with interest added to your balance as it's paid (APY)."
          />
          <p className="mt-1 text-[44px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-fg">
            {formatPercent(point ? point.apy : o.yield.totalApy)}
          </p>
          <p className="mt-2.5 h-5 text-[13px] font-medium tabular-nums">
            {point ? (
              <span className="text-fg-muted">{daysAgo(point.date, shown.at(-1)!.date)}</span>
            ) : change === null ? null : Math.abs(change) < 0.00005 ? (
              <span className="text-fg-muted">No change this week</span>
            ) : change > 0 ? (
              <span className="text-positive">▲ Up {formatPercent(change)} this week</span>
            ) : (
              <span className="text-fg-muted">▼ Down {formatPercent(-change)} this week</span>
            )}
          </p>
        </div>
        {hasLong ? (
          <div role="radiogroup" aria-label="Chart range" className="flex shrink-0 rounded-full bg-surface-2 p-1">
            {(["1M", "3M"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                onClick={() => {
                  setRange(r);
                  setActive(null);
                }}
                className={cn(
                  "h-7 rounded-full px-3 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg/40",
                  range === r ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="-mx-1 mt-5">
        {history.status === "loading" ? (
          <Skeleton className="mx-1 h-[156px] rounded-2xl" />
        ) : history.status === "unavailable" || shown.length < 2 ? (
          <div className="mx-1 flex h-[156px] items-center justify-center rounded-2xl border border-dashed border-line px-6 text-center text-[13px] text-fg-subtle">
            No rate history for this pool yet.
          </div>
        ) : (
          <RateChart
            points={shown}
            activeIndex={active}
            onActiveIndexChange={setActive}
            label={`Daily rate over the last ${span}, between ${formatPercent(low!)} and ${formatPercent(high!)}. Use the arrow keys to read past days.`}
          />
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
        {history.status === "ready" && low !== null && high !== null ? (
          <>
            Between <span className="tabular-nums text-fg-muted">{formatPercent(low)}</span> and{" "}
            <span className="tabular-nums text-fg-muted">{formatPercent(high)}</span> over the last {span}.{" "}
          </>
        ) : null}
        Rates change daily. Drag across the chart to see past rates.
      </p>
    </section>
  );
}

function InfoLabel({ label, help }: { label: string; help: string }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[13px] text-fg-muted">
        <span>{label}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`What is “${label}”?`}
          onClick={() => setOpen((v) => !v)}
          className="rounded-full text-fg-subtle outline-none transition-colors hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-fg/40"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </div>
      <p id={id} hidden={!open} className="mt-1.5 max-w-[34ch] text-xs leading-relaxed text-fg-muted">
        {help}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- earnings */

const HORIZONS = [
  { label: "In 1 month", years: 1 / 12 },
  { label: "In 6 months", years: 0.5 },
  { label: "In 1 year", years: 1 },
] as const;

function EarningsSection({ opportunity: o, amount }: { opportunity: RatedOpportunity; amount: number }) {
  const principal = amount > 0 ? amount : 1000;
  const network = getNetwork(o.network, o.networkName);
  const year = estimateEarnings(principal, o.yield.totalApy, o.fees);

  return (
    <section>
      <SectionTitle>What {formatWholeUsd(principal)} could earn</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {HORIZONS.map((h) => (
          <div key={h.label} className="min-w-0 rounded-2xl bg-surface-2 px-3 py-3 sm:px-4">
            <p className="text-xs text-fg-muted">{h.label}</p>
            <p className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-positive tabular-nums">
              {formatEarnings(estimateEarnings(principal, o.yield.totalApy, o.fees, { years: h.years }).grossYield)}
            </p>
          </div>
        ))}
      </div>

      <dl className="mt-2 divide-y divide-line rounded-2xl border border-line text-[13px]">
        <FeeRow label={`Network fees to get in and out (${network.name}, est.)`} value={negativeUsd(year.networkFees)} />
        {year.depositFee > 0 ? (
          <FeeRow label={`Deposit fee (${formatBpsAsPercent(o.fees.depositFeeBps)})`} value={negativeUsd(year.depositFee)} />
        ) : null}
        {year.withdrawalFee > 0 ? (
          <FeeRow label={`Withdrawal fee (${formatBpsAsPercent(o.fees.withdrawalFeeBps)})`} value={negativeUsd(year.withdrawalFee)} />
        ) : null}
        <div className="flex items-baseline justify-between gap-4 px-4 py-3">
          <dt className="font-medium text-fg">You&apos;d keep in a year</dt>
          <dd className={cn("font-semibold tabular-nums", year.netEarnings >= 0 ? "text-positive" : "text-danger")}>
            {formatEarnings(year.netEarnings)}
          </dd>
        </div>
        <p className="px-4 py-3 text-xs text-fg-subtle">{breakEven(year)}</p>
      </dl>
      <p className="mt-3 text-xs text-fg-subtle">An estimate if today&apos;s rate stayed the same. It usually won&apos;t.</p>
    </section>
  );
}

function FeeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="min-w-0 text-fg-muted">{label}</dt>
      <dd className="shrink-0 tabular-nums text-fg-muted">{value}</dd>
    </div>
  );
}

function breakEven(year: ReturnType<typeof estimateEarnings>): string {
  if (year.totalFees <= 0) return "No fees to get in or out.";
  if (year.netEarnings < 0 || year.grossYield <= 0) return "At this amount, fees cost more than a year of interest.";
  const days = year.totalFees / (year.grossYield / 365);
  if (days <= 1) return "Fees are covered within a day.";
  if (days < 14) return `Fees are covered within ${Math.ceil(days)} days.`;
  if (days < 60) return `Fees are covered within ${Math.ceil(days / 7)} weeks.`;
  return `Fees are covered within ${Math.ceil(days / 30)} months.`;
}

/* ---------------------------------------------------------- interest split */

const BASE_SOURCE: Record<StrategyType, { label: string; detail: (o: RatedOpportunity) => string }> = {
  lending: { label: "Real interest", detail: () => "Paid by people borrowing from the pool" },
  "curated-vault": { label: "Real interest", detail: () => "Earned in the lending markets the vault uses" },
  "insurance-fund": { label: "Fee income", detail: (o) => `A share of the fees ${o.protocolName} collects` },
  yield: { label: "Strategy yield", detail: (o) => `Earned by ${o.protocolName}'s own strategy` },
};

function InterestSource({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const { baseApy, rewardApy, totalApy } = o.yield;
  const base = BASE_SOURCE[o.strategyType];
  const baseShare = totalApy > 0 ? Math.max(0, Math.min(1, baseApy / totalApy)) : 1;
  const rows = [
    { key: "base", dot: "bg-positive", label: base.label, detail: base.detail(o), value: baseApy, show: true },
    {
      key: "reward",
      dot: "bg-info",
      label: "Bonus rewards",
      detail: "Extra tokens the app hands out. They can stop at any time",
      value: rewardApy,
      show: rewardApy > 0,
    },
  ].filter((r) => r.show);

  return (
    <section>
      <SectionTitle>Where the interest comes from</SectionTitle>
      <div className="flex h-2.5 gap-0.5" aria-hidden>
        <div className="h-full rounded-full bg-positive" style={{ flexGrow: baseShare, flexBasis: 0 }} />
        {rewardApy > 0 ? (
          <div className="h-full rounded-full bg-info" style={{ flexGrow: 1 - baseShare, flexBasis: 0, minWidth: 6 }} />
        ) : null}
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-2.5">
              <span className={cn("mt-[5px] size-2 shrink-0 rounded-full", r.dot)} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{r.label}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">{r.detail}</p>
              </div>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-fg">{formatPercent(r.value)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] leading-relaxed text-fg-muted">{o.description}</p>
      {o.fees.performanceFeeBps > 0 ? (
        <p className="mt-3 text-xs text-fg-subtle">
          {o.protocolName} keeps {formatBpsAsPercent(o.fees.performanceFeeBps)} of the interest as its fee. These rates are after
          that fee.
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------- risk */

const GRADE_TONE: Record<Grade, { text: string; panel: string; summary: string }> = {
  A: {
    text: "text-grade-a",
    panel: "border-grade-a/25 bg-grade-a/[0.08]",
    summary: "Lower risk than most options here. Not risk-free.",
  },
  B: {
    text: "text-grade-b",
    panel: "border-grade-b/25 bg-grade-b/[0.08]",
    summary: "Moderate risk. Worth reading the details below.",
  },
  C: {
    text: "text-grade-c",
    panel: "border-grade-c/25 bg-grade-c/[0.08]",
    summary: "Higher risk. Read the details below before depositing.",
  },
  D: {
    text: "text-grade-d",
    panel: "border-grade-d/25 bg-grade-d/[0.08]",
    summary: "Highest risk. Only use money you can afford to lose.",
  },
};

/** Plain names for the risk factors, in the order they're shown. */
const FACTOR_NAMES: Array<[RiskFactorId, string]> = [
  ["smartContract", "Security reviews"],
  ["tvl", "Size of the pool"],
  ["liquidity", "How easy it is to withdraw"],
  ["yieldVolatility", "How steady the rate is"],
  ["maturity", "Time running"],
  ["complexity", "How simple the strategy is"],
  ["oracle", "Price feeds"],
  ["incidents", "Past hacks or losses"],
  ["concentration", "How spread out the money is"],
];

function RiskSection({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const s = o.safety;
  const tone = GRADE_TONE[s.grade];
  const factors = FACTOR_NAMES.flatMap(([id, name]) => {
    const f = s.factors.find((x) => x.id === id);
    return f ? [{ ...f, name }] : [];
  });
  const known = factors.filter((f) => f.known);
  const unknown = factors.filter((f) => !f.known);

  return (
    <section>
      <SectionTitle>How risky is it?</SectionTitle>
      <div className={cn("flex items-center gap-4 rounded-2xl border px-4 py-4", tone.panel)}>
        <ScoreRing score={s.score} className={tone.text} />
        <div className="min-w-0">
          <p className={cn("flex items-center gap-1.5 text-base font-semibold", tone.text)}>
            Grade {s.display}: {s.label}
            <Link
              href="/safety"
              aria-label="How grades work"
              className="rounded-full text-fg-subtle outline-none transition-colors hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-fg/40"
            >
              <CircleHelp className="size-3.5" />
            </Link>
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{tone.summary}</p>
          {s.caps.map((cap) => (
            <p key={cap} className="mt-1 text-xs leading-relaxed text-fg-muted">
              {cap}
            </p>
          ))}
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        {known.map((f) => (
          <FactorRow key={f.id} factor={f} name={f.name} />
        ))}
      </ul>
      {unknown.length > 0 ? (
        <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-fg-muted">
          <span className="font-medium text-fg">Not checked yet:</span>{" "}
          {unknown.map((f) => f.name.toLowerCase()).join(", ")}. Missing information counts against the grade.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-fg-subtle">
        StableSave safety grade ({s.methodologyVersion}). Not a guarantee against loss.{" "}
        <Link href="/safety" className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted">
          How we rate
        </Link>
      </p>
    </section>
  );
}

function ScoreRing({ score, className }: { score: number; className?: string }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className={cn("relative size-14 shrink-0", className)}>
      <svg viewBox="0 0 56 56" className="size-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={5} />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold tabular-nums text-fg">
        <span className="sr-only">Score </span>
        {Math.round(score)}
        <span className="sr-only"> out of 100</span>
      </span>
    </div>
  );
}

function FactorRow({ factor: f, name }: { factor: FactorAssessment; name: string }) {
  const bar = f.score >= 70 ? "bg-positive" : f.score >= 45 ? "bg-warning" : "bg-danger";
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-fg">{name}</span>
        <span className="text-[13px] tabular-nums text-fg-subtle">{Math.round(f.score)}/100</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.max(3, f.score)}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{f.detail}</p>
    </li>
  );
}

/* ------------------------------------------------------------ how to deposit */

const ASSET_COLOR: Record<StableAsset, string> = { USDC: "#2775CA", USDT: "#26A17B" };

function DepositSteps({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const network = getNetwork(o.network, o.networkName);
  const steps: React.ReactNode[] = [
    o.officialDomain ? (
      <>
        Open <strong className="font-semibold text-fg">{o.officialDomain}</strong> with the button below. Check the address bar
        matches before you do anything.
      </>
    ) : (
      <>
        We don&apos;t have a verified link for {o.protocolName} yet. Find its official site from its{" "}
        {o.provenance.provider} page and check the address carefully.
      </>
    ),
    <>
      Connect your wallet on their site. Make sure it&apos;s on the <strong className="font-semibold text-fg">{network.name}</strong>{" "}
      network.
    </>,
    <>
      Find the{" "}
      <span className="inline-flex translate-y-px items-center gap-1 rounded-md bg-surface-3 px-1.5 py-px font-medium text-fg">
        <span
          className="flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ backgroundColor: ASSET_COLOR[o.asset] }}
          aria-hidden
        >
          {o.asset === "USDC" ? "$" : "₮"}
        </span>
        {poolName(o)}
      </span>{" "}
      pool and deposit {o.asset}.
    </>,
    <>New to this? Try a small amount first, then add more once you&apos;re comfortable.</>,
  ];

  return (
    <section>
      <SectionTitle>How to deposit safely</SectionTitle>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-sm leading-relaxed text-fg-muted">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold tabular-nums text-fg">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Disclaimer({ opportunity: o }: { opportunity: RatedOpportunity }) {
  const extras: string[] = [];
  if (o.strategyType === "insurance-fund") {
    extras.push("This pool covers other traders' losses. If they leave bad debt, it's paid from deposits like yours.");
  }
  if (o.strategyType === "curated-vault") {
    extras.push("A curator decides where the vault puts your money, including markets you didn't pick.");
  }
  if (o.strategyType === "yield") {
    extras.push(`We haven't reviewed how ${o.protocolName} earns this yield. Read its docs first: some strategies use leverage or trading.`);
  }
  if (o.risk.withdrawalDelayHours > 0) {
    extras.push(`Withdrawals take about ${Math.max(1, Math.round(o.risk.withdrawalDelayHours / 24))} days to arrive.`);
  } else if (o.risk.utilization !== null && o.risk.utilization >= 0.9) {
    extras.push(`${formatPercent(o.risk.utilization, 0)} of this pool is lent out, so large withdrawals may have to wait.`);
  }
  if (o.network !== "solana") {
    extras.push(
      `If your ${o.asset} is on another network, moving it to ${o.networkName} means a bridge or an exchange, which adds its own risk and fees.`,
    );
  }

  return (
    <div className="flex gap-3 rounded-2xl border border-line px-4 py-3.5 text-[13px] leading-relaxed text-fg-muted">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
      <div className="space-y-2">
        <p>
          DeFi apps aren&apos;t banks, so there&apos;s no deposit insurance. Bugs, hacks, or a stablecoin losing its $1 value could
          mean losing money. Only deposit what you can afford to lose.
        </p>
        {extras.map((e) => (
          <p key={e}>{e}</p>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- quick facts */

const STRATEGY_LABEL: Record<StrategyType, string> = {
  lending: "Lending",
  "curated-vault": "Managed vault",
  "insurance-fund": "Insurance fund",
  yield: "Yield strategy",
};

function QuickFacts({ opportunity: o, history }: { opportunity: RatedOpportunity; history: RateHistoryState }) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);
  const network = getNetwork(o.network, o.networkName);
  const average = o.yield.avgApy30d ?? averageOver(history.points, 30);
  const audits = o.risk.audits;
  const days = o.risk.trackRecordDays;

  const facts: Array<[string, React.ReactNode]> = [["Money in pool", formatCompactUsd(o.tvlUsd)]];
  if (o.risk.utilization !== null) {
    facts.push([
      "Ready to withdraw now",
      `${formatCompactUsd(o.liquidityUsd)} (${formatPercent(1 - o.risk.utilization, 0)})`,
    ]);
  }
  if (o.protocolTvlUsd) facts.push(["Trusted to the app", formatCompactUsd(o.protocolTvlUsd)]);
  facts.push(["Type of app", STRATEGY_LABEL[o.strategyType]]);
  facts.push(["Security reviews", audits === null ? "Not checked" : audits === 0 ? "None listed" : `${audits} listed`]);
  if (average !== null) facts.push(["Average rate (30 days)", formatPercent(average)]);
  if (days !== null && days !== undefined) facts.push(["Running for", formatDays(days)]);
  facts.push(["Network", network.name]);
  facts.push([
    "Last updated",
    <span key="updated" suppressHydrationWarning>
      {now ? formatRelativeTime(o.updatedAt, now) : "—"}
    </span>,
  ]);

  return (
    <section>
      <SectionTitle>Quick facts</SectionTitle>
      <dl className="divide-y divide-line rounded-2xl bg-surface-2 text-[13px]">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-right font-semibold tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
        {o.provenance.mode === "demo" ? "Demo snapshot. " : `${o.provenance.note ?? ""} `}
        {o.provenance.sourceUrl ? (
          <a
            href={o.provenance.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline decoration-line-strong underline-offset-2 hover:text-fg-muted"
          >
            View on {o.provenance.provider}
            <ArrowUpRight className="size-3" />
          </a>
        ) : null}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------------- CTA */

function DepositCta({ opportunity: o, amount }: { opportunity: RatedOpportunity; amount: number }) {
  return (
    <div className="flex flex-col gap-3">
      {o.officialUrl ? (
        <Button asChild size="lg" className="w-full rounded-full">
          <a href={o.officialUrl} target="_blank" rel="noopener noreferrer">
            Go to this pool on {o.officialDomain ?? o.protocolName}
            <ArrowUpRight />
          </a>
        </Button>
      ) : o.provenance.sourceUrl ? (
        <Button asChild size="lg" variant="secondary" className="w-full rounded-full">
          <a href={o.provenance.sourceUrl} target="_blank" rel="noopener noreferrer">
            Find the official app on {o.provenance.provider}
            <ArrowUpRight />
          </a>
        </Button>
      ) : null}
      {o.asset === "USDC" && o.network === "solana" ? (
        <Button asChild size="lg" variant="secondary" className="w-full rounded-full">
          <Link href={`/vault/deposit?amount=${Math.round(amount)}`}>
            Use StableSave Vault instead
            <ArrowRight />
          </Link>
        </Button>
      ) : null}
      <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-fg-subtle">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        <span>
          {o.officialDomain ? `You'll deposit on ${o.officialDomain}. ` : null}
          StableSave never touches your money.
        </span>
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- helpers */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3.5 text-base font-semibold tracking-[-0.01em] text-fg">{children}</h3>;
}

function poolName(o: RatedOpportunity): string {
  return /^main pool$/i.test(o.marketName) ? o.productName : o.marketName;
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function daysAgo(date: string, latest: string): string {
  const days = Math.round((Date.parse(`${latest}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function changeOver(points: readonly RatePoint[], days: number): number | null {
  if (points.length <= days) return null;
  return points.at(-1)!.apy - points.at(-1 - days)!.apy;
}

function averageOver(points: readonly RatePoint[], days: number): number | null {
  const recent = points.slice(-days);
  return recent.length >= Math.min(days, 7) ? recent.reduce((sum, p) => sum + p.apy, 0) / recent.length : null;
}

function formatDays(days: number): string {
  if (days < 365) return `${days} day${days === 1 ? "" : "s"}`;
  const years = days / 365;
  return `${years >= 10 ? Math.floor(years) : years.toFixed(1).replace(/\.0$/, "")} years`;
}

function formatWholeUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function negativeUsd(value: number): string {
  if (value <= 0) return "$0.00";
  const formatted = formatNetworkFee(value);
  return formatted.startsWith("<") ? formatted : `−${formatted}`;
}
