"use client";

import { Button, DialogContent, DialogDescription, DialogTitle, Dialog, Eyebrow } from "@stablesave/ui";
import { ShieldCheck } from "lucide-react";
import * as React from "react";
import { LogoMark } from "@/components/brand/logo";
import { readStorage, writeStorage } from "@/lib/storage";

const STORAGE_KEY = "stablesave:onboarded:v1";

interface OnboardingState {
  open: boolean;
  show: () => void;
  dismiss: () => void;
}

const OnboardingContext = React.createContext<OnboardingState>({ open: false, show: () => {}, dismiss: () => {} });

export function useOnboarding() {
  return React.useContext(OnboardingContext);
}

/** Calls `onDismiss` listeners so the page can focus the calculator. */
export const ONBOARDING_DONE_EVENT = "stablesave:onboarding-done";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    // Only on the home page, only the first time.
    if (window.location.pathname === "/" && !readStorage(STORAGE_KEY)) setOpen(true);
  }, []);

  const value = React.useMemo<OnboardingState>(
    () => ({
      open,
      show: () => setOpen(true),
      dismiss: () => {
        writeStorage(STORAGE_KEY, "1");
        setOpen(false);
        window.dispatchEvent(new Event(ONBOARDING_DONE_EVENT));
      },
    }),
    [open],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : value.dismiss())} onDone={value.dismiss} />
    </OnboardingContext.Provider>
  );
}

const STEPS = [
  {
    title: "Tell us how much you have",
    body: "USDC or USDT. Stablecoins designed to stay around $1.",
  },
  {
    title: "We compare options for you",
    body: "Compare current rates, liquidity and risk across supported Solana protocols.",
  },
  {
    title: "Choose where to deposit",
    body: "We send you directly to the official protocol or let you use StableSave's vault.",
  },
];

function OnboardingDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-canvas/92 backdrop-blur-md"
        className="max-h-[calc(100dvh-24px)] max-w-[452px] overflow-y-auto px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-9"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex size-11 items-center justify-center rounded-[14px] border border-line bg-surface-2">
          <LogoMark className="size-5" />
        </div>

        <Eyebrow className="mt-6">Welcome to StableSave</Eyebrow>
        <DialogTitle className="mt-2.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-balance sm:text-[30px]">
          Put your idle stablecoins to work
        </DialogTitle>
        <DialogDescription className="mt-3 text-[15px] leading-relaxed text-fg-muted">
          USDC and USDT can earn yield. StableSave shows you where, how much, and how risky.
        </DialogDescription>

        <ol className="mt-7 flex flex-col gap-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="w-6 shrink-0 pt-px text-[13px] font-medium tabular-nums text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[15px] font-medium text-fg">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <ShieldCheck className="mt-0.5 size-[18px] shrink-0 text-positive" />
          <div className="text-sm leading-relaxed">
            <p className="font-medium text-fg">Browsing is completely safe.</p>
            <p className="mt-0.5 text-fg-muted">DeFi isn&apos;t a bank, so every option gets an A–D safety grade.</p>
          </div>
        </div>

        <Button size="lg" className="mt-6 w-full" onClick={onDone}>
          Show me my options
        </Button>
        <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Free · No wallet · No sign-up
        </p>
      </DialogContent>
    </Dialog>
  );
}
