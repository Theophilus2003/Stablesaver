"use client";

import { Button } from "@stablesave/ui";
import { ArrowUpRight, Check, Copy, Zap } from "lucide-react";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { blinkUrl } from "@/lib/actions/solana-actions";

/**
 * The vault's deposit Blink: a link anyone can open (dial.to, or a wallet that
 * reads Solana Actions) to deposit without visiting the site.
 */
export function BlinkCard() {
  const env = useEnvironment();
  const [origin, setOrigin] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => setOrigin(window.location.origin), []);
  if (!env.vaultDeployed || !origin) return null;

  const link = blinkUrl(`${origin}/api/actions/deposit`, env.cluster);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(link, "_blank", "noopener");
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-brand/20 bg-brand/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Zap className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Deposit from a link</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
            A Solana Blink: anyone with test USDC can deposit from a post or a QR code, without visiting this site.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button asChild variant="primary" size="sm">
          <a href={link} target="_blank" rel="noopener noreferrer">
            Open Blink
            <ArrowUpRight />
          </a>
        </Button>
      </div>
    </section>
  );
}
