import type { Grade } from "./types";

export const RISK_PROFILE_IDS = ["safe", "balanced", "bigger"] as const;
export type RiskProfile = (typeof RISK_PROFILE_IDS)[number];

export interface RiskProfileConfig {
  id: RiskProfile;
  label: string;
  description: string;
  /** Worst grade this profile will recommend. */
  minGrade: Grade;
  /** How much the ranking values safety vs. yield. Sums to 1. */
  safetyWeight: number;
  yieldWeight: number;
  /**
   * Largest share of an option's available liquidity a single deposit should
   * represent. Above this, getting your money back quickly is less certain.
   */
  maxShareOfLiquidity: number;
  /** Index used by the on-chain vault (`risk_profile: u8`). */
  onchainId: 0 | 1 | 2;
}

export const RISK_PROFILES: Record<RiskProfile, RiskProfileConfig> = {
  safe: {
    id: "safe",
    label: "Play it safe",
    description: "Prioritize lower-risk strategies and established protocols.",
    minGrade: "A",
    safetyWeight: 0.75,
    yieldWeight: 0.25,
    maxShareOfLiquidity: 0.02,
    onchainId: 0,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "A mix of relative safety and better yield.",
    minGrade: "B",
    safetyWeight: 0.5,
    yieldWeight: 0.5,
    maxShareOfLiquidity: 0.05,
    onchainId: 1,
  },
  bigger: {
    id: "bigger",
    label: "Go bigger",
    description: "Accept more protocol and strategy risk for potentially higher yield.",
    minGrade: "C",
    safetyWeight: 0.25,
    yieldWeight: 0.75,
    maxShareOfLiquidity: 0.1,
    onchainId: 2,
  },
};

export function isRiskProfile(value: unknown): value is RiskProfile {
  return typeof value === "string" && (RISK_PROFILE_IDS as readonly string[]).includes(value);
}

export function profileFromOnchainId(id: number): RiskProfile | undefined {
  return RISK_PROFILE_IDS.find((p) => RISK_PROFILES[p].onchainId === id);
}
