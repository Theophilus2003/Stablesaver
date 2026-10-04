import type { Metadata } from "next";
import { VaultHome } from "@/components/vault/vault-home";
import { getMarketSnapshot } from "@/lib/data/snapshot";

// Demo snapshots carry a timestamp; don't freeze it at build time.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Vault",
  description: "Deposit USDC once and let the StableSave Vault split it across Solana protocols.",
};

export default async function VaultPage() {
  const snapshot = await getMarketSnapshot();
  return <VaultHome snapshot={snapshot} />;
}
