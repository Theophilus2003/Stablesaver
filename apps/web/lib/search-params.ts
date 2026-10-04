import { isRiskProfile, STABLE_ASSETS, type RiskProfile, type StableAsset } from "@stablesave/core";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAmountParam(value: string | string[] | undefined, fallback = 10_000): number {
  const n = Number(first(value));
  return Number.isFinite(n) && n > 0 && n < 1e12 ? n : fallback;
}

export function parseAssetParam(value: string | string[] | undefined): StableAsset {
  const v = first(value)?.toUpperCase();
  return (STABLE_ASSETS as readonly string[]).includes(v ?? "") ? (v as StableAsset) : "USDC";
}

export function parseRiskParam(value: string | string[] | undefined, fallback: RiskProfile = "balanced"): RiskProfile {
  const v = first(value);
  return isRiskProfile(v) ? v : fallback;
}

export function parseStringParam(value: string | string[] | undefined): string | null {
  return first(value) ?? null;
}
