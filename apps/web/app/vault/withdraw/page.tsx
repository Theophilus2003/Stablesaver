import type { Metadata } from "next";
import { WithdrawFlow, WithdrawHeader } from "@/components/vault/withdraw-flow";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { parseAmountParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Withdraw" };

export default async function WithdrawPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const snapshot = await getMarketSnapshot();
  return (
    <div className="mx-auto max-w-[520px] px-4 pt-10 sm:px-6 sm:pt-14">
      <WithdrawHeader />
      <WithdrawFlow snapshot={snapshot} initialAmount={parseAmountParam(params.amount, 5_000)} />
    </div>
  );
}
