import type { Metadata } from "next";
import { SaveExperience } from "@/components/save/save-experience";
import { getBenchmark } from "@/lib/data/benchmark";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { parseAmountParam, parseAssetParam, parseRiskParam, parseStringParam, type SearchParams } from "@/lib/search-params";

export const revalidate = 60;

const SHARE_TITLE = "StableSave — Know the risk before you chase the yield";
const SHARE_DESCRIPTION =
  "Compare stablecoin yield across protocols and networks: an A–D risk grade for every option and what you keep after fees. No sign-up.";

/**
 * The site's own link shows the StableSave card; a shared estimate (amount, stablecoin and risk
 * level in the URL) shows that estimate.
 */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const isEstimate = params.amount !== undefined || params.asset !== undefined || params.risk !== undefined;
  const query = new URLSearchParams({
    amount: String(Math.round(parseAmountParam(params.amount))),
    asset: parseAssetParam(params.asset),
    risk: parseRiskParam(params.risk),
  });
  const image = isEstimate
    ? { url: `/api/og?${query.toString()}`, width: 1200, height: 630, alt: "What your stablecoins could earn with StableSave" }
    : { url: "/api/og", width: 1200, height: 630, alt: "StableSave: know the risk before you chase the yield" };
  return {
    openGraph: { type: "website", siteName: "StableSave", url: "/", title: SHARE_TITLE, description: SHARE_DESCRIPTION, images: [image] },
    twitter: { card: "summary_large_image", title: SHARE_TITLE, description: SHARE_DESCRIPTION, images: [image] },
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
