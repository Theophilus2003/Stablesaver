import { SaveExperience } from "@/components/save/save-experience";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { parseAmountParam, parseAssetParam, parseRiskParam, parseStringParam, type SearchParams } from "@/lib/search-params";

export const revalidate = 60;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const snapshot = await getMarketSnapshot();

  return (
    <SaveExperience
      snapshot={snapshot}
      initial={{
        amount: parseAmountParam(params.amount),
        asset: parseAssetParam(params.asset),
        profile: parseRiskParam(params.risk),
        optionId: parseStringParam(params.option),
      }}
    />
  );
}
