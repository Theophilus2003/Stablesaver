"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Button, cn } from "@stablesave/ui";
import { LoaderCircle, LogOut, Wallet } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import * as React from "react";
import { useWalletDialog } from "./wallet-providers";

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectButton({ className, size = "sm" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const { setOpen } = useWalletDialog();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || !connected || !publicKey) {
    return (
      <Button
        size={size}
        variant="secondary"
        className={className}
        onClick={() => setOpen(true)}
        disabled={mounted && connecting}
      >
        {mounted && connecting ? <LoaderCircle className="animate-spin" /> : <Wallet />}
        {mounted && connecting ? "Connecting" : "Connect wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size={size} variant="secondary" className={cn("gap-2", className)}>
          {wallet?.adapter.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wallet.adapter.icon} alt="" className="size-4 rounded" />
          ) : (
            <Wallet />
          )}
          <span className="tabular-nums">{shortAddress(publicKey.toBase58())}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-48 rounded-2xl border border-line bg-surface-2 p-1.5 shadow-xl data-[state=open]:animate-fade-in"
        >
          <DropdownMenu.Item
            onSelect={() => navigator.clipboard?.writeText(publicKey.toBase58())}
            className="flex cursor-default items-center rounded-xl px-3 py-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg"
          >
            Copy address
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => void disconnect()}
            className="flex cursor-default items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg"
          >
            <LogOut className="size-4" />
            Disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
