"use client";

import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button, DialogContent, DialogDescription, DialogTitle, Dialog } from "@stablesave/ui";
import { ChevronRight, LoaderCircle, Wallet, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { useEnvironment } from "@/components/providers/environment";
import { CLUSTER_LABEL } from "@/lib/env";

const SUGGESTED = [
  { name: "Phantom", url: "https://phantom.com" },
  { name: "Solflare", url: "https://solflare.com" },
  { name: "Backpack", url: "https://backpack.app" },
];

export function WalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { wallets, select, connecting, connected, wallet } = useWallet();
  const { cluster } = useEnvironment();
  const [pending, setPending] = React.useState<WalletName | null>(null);

  const detected = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );

  React.useEffect(() => {
    if (connected && open) {
      setPending(null);
      onOpenChange(false);
    }
  }, [connected, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-semibold tracking-tight">Connect a Solana wallet</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-fg-muted">
              Only needed to deposit. You&apos;re connecting on{" "}
              <span className="text-fg">{CLUSTER_LABEL[cluster]}</span>.
            </DialogDescription>
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </DialogPrimitive.Close>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {detected.length > 0 ? (
            detected.map((w) => {
              const isPending = connecting && (pending === w.adapter.name || wallet?.adapter.name === w.adapter.name);
              return (
                <button
                  key={w.adapter.name}
                  type="button"
                  onClick={() => {
                    setPending(w.adapter.name);
                    select(w.adapter.name);
                  }}
                  className="group flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" className="size-7 rounded-lg" />
                  <span className="font-medium">{w.adapter.name}</span>
                  <span className="ml-auto text-xs text-fg-subtle">
                    {isPending ? <LoaderCircle className="size-4 animate-spin" /> : "Detected"}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="size-4 text-fg-muted" />
                No Solana wallet found in this browser
              </div>
              <p className="mt-1.5 text-sm text-fg-muted">Install one of these, then come back.</p>
              <div className="mt-3 flex flex-col gap-1.5">
                {SUGGESTED.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-fg hover:bg-surface-3"
                  >
                    {s.name}
                    <ChevronRight className="size-4 text-fg-subtle" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-fg-subtle">
          StableSave never asks for your seed phrase and can&apos;t move funds without your signature.
        </p>
      </DialogContent>
    </Dialog>
  );
}
