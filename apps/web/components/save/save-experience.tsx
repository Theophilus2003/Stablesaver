"use client";

import {
  EXAMPLE_VAULT_STRATEGIES,
  blendStrategy,
  recommend,
  type MarketSnapshot,
  type RankedOption,
  type RiskProfile,
  type StableAsset,
} from "@stablesave/core";
import { Card, StatusDot } from "@stablesave/ui";
import { ArrowDown } from "lucide-react";
import * as React from "react";
import { ONBOARDING_DONE_EVENT } from "@/components/onboarding/onboarding";
import { OptionSheet } from "@/components/options/option-sheet";
import { OptionsSection } from "@/components/options/options-section";
import { formatAmountInput, parseAmount } from "@/lib/format";
import { AmountField } from "./amount-field";
import { EarningsPanel } from "./earnings-panel";
import { MarketSummaryStrip } from "./market-summary";
import { RiskSelector } from "./risk-selector";
import { VaultAlternative } from "./vault-alternative";

export interface SaveInitialState {
  amount: number;
  asset: StableAsset;
  profile: RiskProfile;
  optionId: string | null;
}

/**
 * The main flow: amount → risk → estimate → options → detail.
 * Everything recalculates client-side from the snapshot; nothing is hard-coded.
 */
export function SaveExperience({ snapshot, initial }: { snapshot: MarketSnapshot; initial: SaveInitialState }) {
  const [amountText, setAmountText] = React.useState(() => formatAmountInput(String(initial.amount)));
  const [asset, setAsset] = React.useState<StableAsset>(initial.asset);
  const [profile, setProfile] = React.useState<RiskProfile>(initial.profile);
  const [pinnedId, setPinnedId] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(initial.optionId);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountText);
  const deferredAmount = React.useDeferredValue(amount);

  const recommendation = React.useMemo(
    () => recommend({ amount: deferredAmount, asset, profile, opportunities: snapshot.opportunities }),
    [deferredAmount, asset, profile, snapshot.opportunities],
  );

  const pinned: RankedOption | null = pinnedId
    ? (recommendation.ranked.find((r) => r.opportunity.id === pinnedId) ?? null)
    : null;
  const featured = pinned ?? recommendation.best;

  const blend = React.useMemo(
    () => (asset === "USDC" ? blendStrategy(EXAMPLE_VAULT_STRATEGIES[profile], snapshot.opportunities, deferredAmount) : null),
    [asset, profile, snapshot.opportunities, deferredAmount],
  );

  const openOpportunity = openId ? (snapshot.opportunities.find((o) => o.id === openId) ?? null) : null;

  // Keep the URL shareable without adding history entries.
  React.useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set("amount", String(Math.round(amount)));
      params.set("asset", asset);
      params.set("risk", profile);
      if (openId) params.set("option", openId);
      else params.delete("option");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [amount, asset, profile, openId]);

  // After onboarding, put the cursor in the amount field.
  React.useEffect(() => {
    const focus = () => inputRef.current?.focus({ preventScroll: true });
    window.addEventListener(ONBOARDING_DONE_EVENT, focus);
    return () => window.removeEventListener(ONBOARDING_DONE_EVENT, focus);
  }, []);

  function changeAsset(next: StableAsset) {
    setAsset(next);
    setPinnedId(null);
  }

  const demo = snapshot.mode === "demo";
  const unavailable = snapshot.opportunities.length === 0;

  return (
    <>
      <section className="mx-auto max-w-[600px] px-4 pt-12 sm:px-6 sm:pt-20">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-muted">
            <StatusDot tone={unavailable ? "danger" : demo ? "warning" : "positive"} pulse={!demo && !unavailable} />
            {unavailable ? "Rates unavailable" : demo ? "Demo rates" : "Live rates"} · No wallet or sign-up
          </span>
        </div>
        <h1 className="mt-6 text-center text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-balance sm:text-[64px]">
          How much do you
          <br />
          want to grow?
        </h1>
        <p className="mx-auto mt-4 max-w-[460px] text-center text-[15px] leading-relaxed text-fg-muted sm:text-base">
          See what your stablecoins could earn. Compare yield and risk.
        </p>

        <Card className="mt-10 p-1.5 shadow-[0_24px_80px_-32px_rgb(0_0_0/0.8)] sm:p-2">
          <div className="px-4 pb-5 pt-4 sm:px-5 sm:pt-5">
            <AmountField
              value={amountText}
              onChange={setAmountText}
              asset={asset}
              onAssetChange={changeAsset}
              inputRef={inputRef}
            />
          </div>
          <EarningsPanel
            option={featured}
            amount={deferredAmount}
            profile={profile}
            pinned={Boolean(pinned)}
            onOpen={setOpenId}
            onUnpin={() => setPinnedId(null)}
            unavailable={unavailable}
          />
          {blend && deferredAmount > 0 ? (
            <div className="pt-1.5 sm:pt-2">
              <VaultAlternative blend={blend} amount={deferredAmount} profile={profile} />
            </div>
          ) : null}
        </Card>

        <RiskSelector
          value={profile}
          onChange={(p) => {
            setProfile(p);
            setPinnedId(null);
          }}
          className="mt-10"
        />

        <div className="mt-8 flex justify-center">
          <a
            href="#options"
            className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            See all options that fit you
            <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" />
          </a>
        </div>
      </section>

      <div className="mx-auto mt-10 flex max-w-[880px] flex-col gap-10 px-4 sm:px-6">
        <MarketSummaryStrip snapshot={snapshot} asset={asset} onOpen={setOpenId} />
        <OptionsSection
          snapshot={snapshot}
          recommendation={recommendation}
          pinnedId={pinnedId}
          onOpen={setOpenId}
          onTogglePin={(id) => setPinnedId((current) => (current === id ? null : id))}
        />
      </div>

      <OptionSheet
        opportunity={openOpportunity}
        amount={deferredAmount}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </>
  );
}
