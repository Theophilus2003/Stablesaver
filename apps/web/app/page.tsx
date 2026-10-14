import type { Metadata } from "next";
import { SaveExperience } from "@/components/save/save-experience";
import { getBenchmark } from "@/lib/data/benchmark";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { parseAmountParam, parseAssetParam, parseRiskParam, parseStringParam, type SearchParams } from "@/lib/search-params";

export const revalidate = 60;

/** Shared links preview the estimate for the amount, stablecoin and risk level in the URL. */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const query = new URLSearchParams({
    amount: String(Math.round(parseAmountParam(params.amount))),
    asset: parseAssetParam(params.asset),
    risk: parseRiskParam(params.risk),
  });
  const image = { url: `/api/og?${query.toString()}`, width: 1200, height: 630, alt: "What your stablecoins could earn with StableSave" };
  return {
    openGraph: { title: "StableSave — See what your stablecoins could earn", images: [image] },
    twitter: { card: "summary_large_image", images: [image.url] },
  };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [snapshot, benchmark] = await Promise.all([getMarketSnapshot(), getBenchmark()]);

  return (
    <SaveExperience
      snapshot={snapshot}
      benchmark={benchmark}
      initial={{
        amount: parseAmountParam(params.amount),
        asset: parseAssetParam(params.asset),
        profile: parseRiskParam(params.risk),
        optionId: parseStringParam(params.option),
      }}
    />
  );
}
