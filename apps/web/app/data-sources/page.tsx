import { PROTOCOLS, formatRelativeTime } from "@stablesave/core";
import { Badge, StatusDot } from "@stablesave/ui";
import type { Metadata } from "next";
import { ProsePage, ProseSection } from "@/components/layout/prose-page";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { CLUSTER_LABEL, getPublicEnv } from "@/lib/env";

// Demo snapshots carry a timestamp; don't freeze it at build time.
export const revalidate = 60;

export const metadata: Metadata = { title: "Data sources" };

export default async function DataSourcesPage() {
  const snapshot = await getMarketSnapshot();
  const env = getPublicEnv();
  const demo = snapshot.mode === "demo";

  return (
    <ProsePage
      eyebrow="Data sources"
      title="Where the numbers come from"
      intro="Each protocol is read through its own adapter. Every number carries a label saying whether it is demo data or live, and we never fill a gap with made-up figures."
    >
      <ProseSection title="Right now">
        <div className="rounded-[20px] border border-line p-5">
          <div className="flex items-center gap-2">
            <Badge tone={demo ? "warning" : "positive"} size="xs">
              <StatusDot tone={demo ? "warning" : "positive"} pulse={!demo} />
              {demo ? "Demo data" : "Live data"}
            </Badge>
            <span className="text-xs text-fg-subtle">snapshot generated {formatRelativeTime(snapshot.generatedAt)}</span>
          </div>
          <p className="mt-3 text-sm">
            {demo
              ? "Rates, liquidity and risk inputs are illustrative fixtures shaped like real Solana markets. They are not measurements of the protocols named, and the safety grades built from them are examples of the method, not real assessments."
              : "Market data is read from live sources through the protocol adapters."}
          </p>
        </div>
        <ul className="divide-y divide-line rounded-[20px] border border-line">
          {snapshot.adapters.map((a) => (
            <li key={a.protocolId} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-[15px] font-medium text-fg">{a.name}</p>
                <p className="mt-0.5 text-[13px]">{PROTOCOLS[a.protocolId].tagline}</p>
                {a.message ? <p className="mt-1 text-xs text-warning">{a.message}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <Badge size="xs" tone={a.status === "ok" ? (a.mode === "demo" ? "warning" : "positive") : "danger"}>
                  {a.status === "ok" ? (a.mode === "demo" ? "Demo" : "Live") : "Unavailable"}
                </Badge>
                <span className="text-xs text-fg-subtle">{a.opportunityCount} markets</span>
              </div>
            </li>
          ))}
        </ul>
      </ProseSection>

      <ProseSection title="Going live">
        <p>
          Live adapters plug in behind the same interface: Kamino via its lending SDK, MarginFi via its client, Drift via
          its SDK and Save via its SDK or public API. Until each one is connected and verified, it reports as unavailable
          rather than showing old or invented rates.
        </p>
        <p>
          Rates should be sampled from on-chain reserve state; liquidity from available reserve balances; the 30-day
          yield history from an indexer. Incident history is curated by hand and cited.
        </p>
      </ProseSection>

      <ProseSection title="Network and vault">
        <p>
          Wallet and vault transactions use Solana <span className="text-fg">{CLUSTER_LABEL[env.cluster]}</span>.{" "}
          {env.vaultDeployed
            ? `The StableSave Vault program is configured at ${env.vaultProgramId}.`
            : "The StableSave Vault program isn't deployed on this cluster yet, so the vault runs as a simulated preview in your browser."}
        </p>
      </ProseSection>

      <ProseSection title="Estimates">
        <p>
          Yearly earnings are always <span className="text-fg">amount × current rate − fees</span>. Fees include any
          deposit and withdrawal fees plus an estimate of Solana network fees for depositing and withdrawing once.
          Refundable account rent isn&apos;t counted as a cost. Rates change; nothing here is guaranteed.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
