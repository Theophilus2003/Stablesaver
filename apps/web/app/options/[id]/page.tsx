import { Card } from "@stablesave/ui";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OptionDetail } from "@/components/options/option-detail";
import { getOpportunity } from "@/lib/data/snapshot";
import { parseAmountParam, type SearchParams } from "@/lib/search-params";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const { opportunity } = await getOpportunity(id);
  if (!opportunity) return { title: "Option not found" };
  return {
    title: `${opportunity.protocolName} ${opportunity.productName}`,
    description: `${opportunity.protocolName} ${opportunity.productName} on ${opportunity.networkName}: rate, safety grade, liquidity and fees.`,
  };
}

export default async function OptionPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { opportunity } = await getOpportunity(id);
  if (!opportunity) notFound();
  const amount = parseAmountParam(query.amount);

  return (
    <div className="mx-auto max-w-[600px] px-4 pt-10 sm:px-6 sm:pt-14">
      <Link
        href={`/?amount=${Math.round(amount)}&asset=${opportunity.asset}`}
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> All options
      </Link>
      <Card className="mt-6 p-6 sm:p-8">
        <OptionDetail opportunity={opportunity} amount={amount} standalone />
      </Card>
    </div>
  );
}
