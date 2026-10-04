import type { Metadata } from "next";
import { VaultHome } from "@/components/vault/vault-home";
import { getMarketSnapshot } from "@/lib/data/snapshot";

// Market data is fetched per request (and cached in-process), never at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vault",
  description: "Deposit USDC once and let the StableSave Vault split it across Solana protocols.",
};

export default async function VaultPage() {
  const snapshot = await getMarketSnapshot();
  return <VaultHome snapshot={snapshot} />;
}
