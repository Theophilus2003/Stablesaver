import { PROTOCOLS, formatRelativeTime, getNetwork, isVaultProtocol } from "@stablesave/core";
import { Badge, NetworkIcon, StatusDot } from "@stablesave/ui";
import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/prose-page";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { formatNetworkFee } from "@/lib/format";
import { networkBadge } from "@/lib/logos";
import { CLUSTER_LABEL, getPublicEnv } from "@/lib/env";

// Market data is fetched per request (and cached in-process), never at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Data sources" };

export default async function DataSourcesPage() {
  const snapshot = await getMarketSnapshot();
  const env = getPublicEnv();
  const demo = snapshot.mode === "demo";
  const networks = [
    ...snapshot.opportunities
      .reduce((map, o) => {
        const entry = map.get(o.network) ?? { ...getNetwork(o.network, o.networkName), count: 0 };
        entry.count += 1;
        return map.set(o.network, entry);
      }, new Map<string, ReturnType<typeof getNetwork> & { count: number }>())
      .values(),
  ].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <ProsePage
      eyebrow="Data sources"
      title="Where the numbers come from"
      intro="Live rates, deposits and liquidity come from DefiLlama's public yields data. Every number carries a label saying whether it is live or demo data, and we never fill a gap with made-up figures."
    >
      <ProseSection title="Right now">
        <div className="rounded-[20px] border border-line p-5">
          <div className="flex items-center gap-2">
            <Badge tone={demo ? "warning" : "positive"} size="xs">
              <StatusDot tone={demo ? "warning" : "positive"} pulse={!demo} />
              {demo ? "Demo data" : "Live data · DefiLlama"}
            </Badge>
            <span className="text-xs text-fg-subtle">snapshot generated {formatRelativeTime(snapshot.generatedAt)}</span>
          </div>
          <p className="mt-3 text-sm">
            {demo
              ? "Rates, liquidity and risk inputs are illustrative fixtures shaped like real Solana markets. They are not measurements of the protocols named, and the safety grades built from them are examples of the method, not real assessments."
              : snapshot.opportunities.length === 0
                ? "Live data couldn't be loaded just now, so no rates are shown. Details per protocol below."
                : `Rates, deposits and available liquidity are read from DefiLlama, which refreshes them about hourly. We keep single-asset USDC and USDT pools with at least $1M deposited, on every network DefiLlama tracks (${networks.length} right now). Bridged copies such as USDC.e are left out.`}
          </p>
        </div>
        <ul className="divide-y divide-line rounded-[20px] border border-line">
          {snapshot.adapters.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-[15px] font-medium text-fg">{a.name}</p>
                <p className="mt-0.5 text-[13px]">
                  {isVaultProtocol(a.id) ? PROTOCOLS[a.id].tagline : "Every USDC and USDT pool it tracks, across networks."}
                </p>
                {a.message ? <p className="mt-1 text-xs text-warning">{a.message}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <Badge size="xs" tone={a.status === "ok" ? (a.mode === "demo" ? "warning" : "positive") : "danger"}>
                  {a.status === "ok" ? (a.mode === "demo" ? "Demo" : "Live") : "Unavailable"}
                </Badge>
                <span className="text-xs text-fg-subtle">{a.opportunityCount} options</span>
              </div>
            </li>
          ))}
        </ul>
      </ProseSection>

      <ProseSection title="What comes from DefiLlama">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>Current supply APY, split into base yield and token rewards.</li>
          <li>Total supplied and borrowed (so available liquidity and utilization), when DefiLlama reports them.</li>
          <li>How much each rate has moved over time, for the yield-stability factor.</li>
          <li>Protocol listing date, audit links and price-feed (oracle) providers.</li>
        </ul>
        <p>
          Not covered, and shown as <span className="text-fg">not verified</span> in each grade: bug bounties, who can
          upgrade the contracts, incident history, and depositor or collateral concentration. Missing inputs score
          conservatively, and three or more of them cap a grade at B. Network fees are StableSave&apos;s estimates
          (below).
        </p>
        <p>
          Data:{" "}
          <a href="https://defillama.com/yields" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-line-strong underline-offset-2">
            DefiLlama
          </a>
          . Always check the official app before you deposit.
        </p>
      </ProseSection>

      {networks.length > 0 ? (
        <ProseSection title="Networks and fee estimates">
          <p>
            What we assume one deposit and one withdrawal cost on each network, token approval included. Real fees move
            with network traffic; on Ethereum they can be much higher or lower than this.
          </p>
          <ul className="divide-y divide-line rounded-[20px] border border-line">
            {networks.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-fg">
                  <NetworkIcon network={networkBadge(n)} className="size-4" />
                  {n.name}
                  <span className="text-xs text-fg-subtle tabular-nums">
                    {n.count} {n.count === 1 ? "option" : "options"}
                  </span>
                </span>
                <span className="tabular-nums text-fg-muted">~{formatNetworkFee(n.estimatedNetworkFeeUsd)}</span>
              </li>
            ))}
          </ul>
        </ProseSection>
      ) : null}

      <ProseSection title="Wallet and vault">
        <p>
          The StableSave Vault and wallet connection use Solana <span className="text-fg">{CLUSTER_LABEL[env.cluster]}</span>.{" "}
          {env.vaultDeployed
            ? `The StableSave Vault program is configured at ${env.vaultProgramId}.`
            : "The StableSave Vault program isn't deployed on this cluster yet, so the vault runs as a simulated preview in your browser."}
        </p>
      </ProseSection>

      <ProseSection title="Estimates">
        <p>
          Yearly earnings are always <span className="text-fg">amount × current rate − fees</span>. Fees include any
          deposit and withdrawal fees plus an estimate of that network&apos;s fees for depositing and withdrawing once,
          so on an expensive network a small deposit can earn less than it costs. Those options are marked. Refundable
          account rent isn&apos;t counted as a cost. Rates change; nothing here is guaranteed.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
