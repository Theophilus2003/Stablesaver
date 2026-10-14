import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BlinkPreview } from "@/components/vault/blink-preview";
import { VaultModeBanner } from "@/components/vault/vault-parts";

export const metadata: Metadata = { title: "Deposit Blink" };

export default function BlinkPage() {
  return (
    <div className="mx-auto flex max-w-[520px] flex-col gap-6 px-4 pt-10 sm:px-6 sm:pt-14">
      <div>
        <Link href="/vault" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Vault
        </Link>
        <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.035em]">Deposit Blink</h1>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          A Solana Action turns a deposit into a link. This card is drawn from that Action, exactly as a Blink client
          draws it, and the transaction comes from the same endpoint.
        </p>
      </div>
      <VaultModeBanner />
      <BlinkPreview />
    </div>
  );
}
