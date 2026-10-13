"use client";

import { ASSET_INFO, STABLE_ASSETS, type StableAsset } from "@stablesave/core";
import { cn } from "@stablesave/ui";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";

const TOKEN_TINT: Record<StableAsset, string> = {
  USDC: "#3e73c4",
  USDT: "#2fa37f",
};

export function TokenDot({ asset, className }: { asset: StableAsset; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-5 shrink-0 overflow-hidden rounded-full", className)}
      style={{ backgroundColor: TOKEN_TINT[asset] }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/tokens/${asset.toLowerCase()}.svg`} alt="" decoding="async" className="size-full" />
    </span>
  );
}

export function AssetSelect({ value, onChange }: { value: StableAsset; onChange: (asset: StableAsset) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5 pr-3 text-[15px] font-medium outline-none transition-colors hover:border-line-strong hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-fg/40 data-[state=open]:bg-surface-3"
        aria-label={`Stablecoin: ${value}`}
      >
        <TokenDot asset={value} className="size-7 text-[11px]" />
        {value}
        <ChevronDown className="size-4 text-fg-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-56 rounded-2xl border border-line bg-surface-2 p-1.5 shadow-xl data-[state=open]:animate-fade-in"
        >
          {STABLE_ASSETS.map((asset) => (
            <DropdownMenu.Item
              key={asset}
              onSelect={() => onChange(asset)}
              className="flex cursor-default items-center gap-3 rounded-xl px-2.5 py-2 outline-none data-[highlighted]:bg-surface-3"
            >
              <TokenDot asset={asset} className="size-7 text-[11px]" />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{asset}</span>
                <span className="text-xs text-fg-muted">
                  {ASSET_INFO[asset].name} · {ASSET_INFO[asset].issuer}
                </span>
              </span>
              {asset === value ? <Check className="ml-auto size-4 text-fg" /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
