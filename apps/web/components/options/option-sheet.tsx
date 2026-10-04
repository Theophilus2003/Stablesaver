"use client";

import type { RatedOpportunity } from "@stablesave/core";
import { Button, Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@stablesave/ui";
import { Link2, X } from "lucide-react";
import Link from "next/link";
import { OptionDetail } from "./option-detail";

export function OptionSheet({
  opportunity,
  amount,
  onOpenChange,
}: {
  opportunity: RatedOpportunity | null;
  amount: number;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(opportunity)} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
        {opportunity ? (
          <>
            <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-3 md:px-6 md:pt-5">
              <SheetTitle className="text-[13px] font-medium text-fg-muted">Option details</SheetTitle>
              <SheetDescription className="sr-only">
                {opportunity.protocolName} {opportunity.productName}: rate, risk, liquidity and fees.
              </SheetDescription>
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="icon-sm" aria-label="Open as page">
                  <Link href={`/options/${opportunity.id}?amount=${Math.round(amount)}`}>
                    <Link2 />
                  </Link>
                </Button>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Close">
                    <X />
                  </Button>
                </SheetClose>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-4 md:px-6">
              <OptionDetail opportunity={opportunity} amount={amount} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
