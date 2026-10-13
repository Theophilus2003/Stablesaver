"use client";

import type { RatedOpportunity } from "@stablesave/core";
import { Button, Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@stablesave/ui";
import { Link2, X } from "lucide-react";
import Link from "next/link";
import { OptionDetail, OptionHeader } from "./option-detail";

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
            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4 md:px-6 md:pt-6">
              <OptionHeader opportunity={opportunity} titleAs={SheetTitle} />
              <SheetDescription className="sr-only">
                {opportunity.protocolName} {opportunity.productName}: rate history, earnings, risk and how to deposit.
              </SheetDescription>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button asChild variant="ghost" size="icon-sm" aria-label="Open as page" className="rounded-full">
                  <Link href={`/options/${opportunity.id}?amount=${Math.round(amount)}`}>
                    <Link2 />
                  </Link>
                </Button>
                <SheetClose asChild>
                  <Button variant="secondary" size="icon-sm" aria-label="Close" className="rounded-full">
                    <X />
                  </Button>
                </SheetClose>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-5 md:px-6">
              <OptionDetail opportunity={opportunity} amount={amount} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
