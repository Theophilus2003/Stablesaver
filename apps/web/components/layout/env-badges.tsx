"use client";

import { Badge, StatusDot, cn } from "@stablesave/ui";
import { usePathname } from "next/navigation";
import { useEnvironment } from "@/components/providers/environment";
import { CLUSTER_LABEL } from "@/lib/env";

/** DEMO DATA vs live market data. */
export function DataModeBadge({ className }: { className?: string }) {
  const { dataMode } = useEnvironment();
  if (dataMode === "demo") {
    return (
      <Badge
        tone="warning"
        size="xs"
        className={className}
        title="Rates, liquidity and risk inputs are illustrative demo values, not live measurements."
      >
        <StatusDot tone="warning" />
        Demo data
      </Badge>
    );
  }
  return (
    <Badge tone="positive" size="xs" className={className} title="Market data is read from live sources.">
      <StatusDot tone="positive" pulse />
      Live data
    </Badge>
  );
}

/** DEVNET / MAINNET, plus PREVIEW while the vault program isn't deployed. */
export function ClusterBadge({ className }: { className?: string }) {
  const { cluster, vaultDeployed } = useEnvironment();
  const mainnet = cluster === "mainnet-beta";
  return (
    <Badge
      tone={mainnet ? "positive" : "info"}
      size="xs"
      className={className}
      title={
        vaultDeployed
          ? `Vault transactions go to Solana ${CLUSTER_LABEL[cluster]}.`
          : `The vault isn't deployed on ${CLUSTER_LABEL[cluster]} yet. Deposits are simulated.`
      }
    >
      <span className="size-1.5 rounded-full bg-gradient-to-br from-sol-purple to-sol-green" aria-hidden />
      {CLUSTER_LABEL[cluster]}
      {vaultDeployed ? null : <span className="text-fg-subtle">· Preview</span>}
    </Badge>
  );
}

export function EnvBadges({ className }: { className?: string }) {
  const pathname = usePathname();
  const onVault = pathname?.startsWith("/vault");
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {onVault ? (
        <>
          {/* Vault estimates still use market data, so keep its label visible where there's room. */}
          <DataModeBadge className="hidden sm:inline-flex" />
          <ClusterBadge />
        </>
      ) : (
        <DataModeBadge />
      )}
    </div>
  );
}
