"use client";

import type { StableAsset } from "@stablesave/core";
import { cn } from "@stablesave/ui";
import * as React from "react";
import { formatAmountInput, parseAmount } from "@/lib/format";
import { AssetSelect } from "./asset-select";

export const QUICK_AMOUNTS = [
  { label: "$100", value: 100 },
  { label: "$1k", value: 1_000 },
  { label: "$10k", value: 10_000 },
  { label: "$50k", value: 50_000 },
];

export interface AmountFieldProps {
  value: string;
  onChange: (display: string) => void;
  asset: StableAsset;
  onAssetChange?: (asset: StableAsset) => void;
  label?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  quickAmounts?: boolean;
  /** Shown under the input, e.g. wallet balance. */
  hint?: React.ReactNode;
}

export function AmountField({
  value,
  onChange,
  asset,
  onAssetChange,
  label = "You have",
  inputRef,
  quickAmounts = true,
  hint,
}: AmountFieldProps) {
  const id = React.useId();
  const amount = parseAmount(value);
  const size = value.length > 11 ? "text-[34px] sm:text-[40px]" : value.length > 8 ? "text-[40px] sm:text-[46px]" : "text-[44px] sm:text-[52px]";

  return (
    <div>
      <label htmlFor={id} className="text-[13px] text-fg-muted">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-3">
        <div className={cn("flex min-w-0 flex-1 items-baseline font-semibold leading-none tracking-[-0.035em]", size)}>
          <span className={cn("mr-0.5 transition-colors", amount > 0 ? "text-fg" : "text-fg-subtle")}>$</span>
          <input
            ref={inputRef}
            id={id}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="0"
            value={value}
            onChange={(e) => onChange(formatAmountInput(e.target.value))}
            className="w-full min-w-0 bg-transparent tabular-nums text-fg outline-none placeholder:text-fg-subtle"
            aria-describedby={hint ? `${id}-hint` : undefined}
          />
        </div>
        {onAssetChange ? (
          <AssetSelect value={asset} onChange={onAssetChange} />
        ) : (
          <span className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-2 text-[15px] font-medium">{asset}</span>
        )}
      </div>
      {hint ? (
        <div id={`${id}-hint`} className="mt-2 text-xs text-fg-muted">
          {hint}
        </div>
      ) : null}
      {quickAmounts ? (
        <div className="mt-4 flex gap-2" role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((q) => {
            const active = amount === q.value;
            return (
              <button
                key={q.value}
                type="button"
                onClick={() => onChange(formatAmountInput(String(q.value)))}
                aria-pressed={active}
                className={cn(
                  "h-8 flex-1 rounded-full border text-[13px] font-medium tabular-nums transition-colors sm:flex-none sm:px-4",
                  active
                    ? "border-line-strong bg-surface-3 text-fg"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
