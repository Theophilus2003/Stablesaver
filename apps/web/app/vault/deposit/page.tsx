import type { Metadata } from "next";
import { DepositFlow, DepositHeader } from "@/components/vault/deposit-flow";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { parseAmountParam, parseRiskParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Deposit" };

export default async function DepositPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const snapshot = await getMarketSnapshot();
  return (
    <div className="mx-auto max-w-[520px] px-4 pt-10 sm:px-6 sm:pt-14">
      <DepositHeader />
      <DepositFlow snapshot={snapshot} initialAmount={parseAmountParam(params.amount)} initialProfile={parseRiskParam(params.risk)} />
    </div>
  );
}
