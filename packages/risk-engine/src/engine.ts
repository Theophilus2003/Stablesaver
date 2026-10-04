import {
  GRADE_SUMMARIES,
  gradeFromScore,
  maxScoreFor,
  type FactorAssessment,
  type FactorImpact,
  type Opportunity,
  type RatedOpportunity,
  type SafetyAssessment,
} from "@stablesave/core";
import { FACTORS, type FactorDefinition } from "./factors";

export const METHODOLOGY_VERSION = "ss-safety-1.0";

export const SAFETY_ASSESSMENT_LABEL = "StableSave safety assessment";
export const SAFETY_DISCLAIMER = "Not a guarantee against loss.";

export interface SafetyGradeOptions {
  now?: Date;
  factors?: readonly FactorDefinition[];
}

interface CapRule {
  /** Highest score allowed when the rule applies. */
  ceiling: number;
  applies(o: Opportunity, now: Date): boolean;
  reason: string;
}

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

/** Share of the score from the weighted average; the rest comes from the weakest factor. */
const WEIGHTED_SHARE = 0.75;

/**
 * Hard limits. A weighted average can hide one serious problem behind several
 * good numbers; caps make sure it can't.
 */
const CAP_RULES: readonly CapRule[] = [
  {
    ceiling: maxScoreFor("C", ""),
    reason: "Lost user funds in the last two years without making users whole, so it can't grade above C.",
    applies: (o, now) =>
      o.risk.incidents.some(
        (i) =>
          i.fundsLost && !i.usersReimbursed && now.getTime() - new Date(i.date).getTime() < 24 * MONTH_MS,
      ),
  },
  {
    ceiling: maxScoreFor("C", ""),
    reason: "Your deposit is first in line to cover other people's losses, so it can't grade above C.",
    applies: (o) => o.strategyType === "insurance-fund",
  },
  {
    ceiling: maxScoreFor("C", ""),
    reason: "No public audits, so it can't grade above C.",
    applies: (o) => o.risk.audits === 0,
  },
  {
    ceiling: maxScoreFor("C", "+"),
    reason: "Live for under six months, so it can't grade above C+.",
    applies: (o, now) =>
      o.risk.launchedAt !== null && now.getTime() - new Date(o.risk.launchedAt).getTime() < 6 * MONTH_MS,
  },
  {
    ceiling: maxScoreFor("C", "+"),
    reason: "A single key can change the code, so it can't grade above C+.",
    applies: (o) => o.risk.upgradeAuthority === "single-key",
  },
  {
    ceiling: maxScoreFor("B", "-"),
    reason: "Almost all deposits are lent out, so withdrawals could stall. It can't grade above B-.",
    applies: (o) => o.risk.utilization !== null && o.risk.utilization >= 0.98,
  },
];

/** Caps that depend on the assessed factors rather than raw inputs. */
const UNKNOWN_FACTOR_CAP = {
  /** This many unverified factors or more… */
  threshold: 3,
  ceiling: maxScoreFor("B", ""),
  reason: "Too many risk inputs are unverified to grade above B.",
};

/** Plain-English list of the hard caps, for the methodology page. */
export function describeCapRules(): string[] {
  return [...CAP_RULES.map((r) => r.reason), UNKNOWN_FACTOR_CAP.reason];
}

function impactFor(score: number): FactorImpact {
  if (score >= 75) return "positive";
  if (score < 50) return "negative";
  return "neutral";
}

/**
 * calculateSafetyGrade(opportunity) → { grade, score, reasons, … }
 *
 * Produces StableSave's relative safety assessment for one opportunity. It
 * weighs protocol maturity, TVL, liquidity, smart-contract posture, strategy
 * complexity, incident history, yield volatility, oracle dependencies and
 * concentration, blends in the weakest factor, then applies hard caps.
 *
 * This is an opinion built from the data we have, not objective truth, and it
 * is not a guarantee against loss.
 */
export function calculateSafetyGrade(opportunity: Opportunity, options: SafetyGradeOptions = {}): SafetyAssessment {
  const now = options.now ?? new Date();
  const definitions = options.factors ?? FACTORS;
  const totalWeight = definitions.reduce((s, f) => s + f.weight, 0);

  const factors: FactorAssessment[] = definitions.map((def) => {
    const { score, detail, known = true } = def.evaluate(opportunity, now);
    const rounded = Math.round(score);
    return { id: def.id, label: def.label, weight: def.weight, score: rounded, known, impact: impactFor(rounded), detail };
  });

  const weighted = factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight;
  // Weakest link: a quarter of the score comes from the worst *measured*
  // factor, so one serious problem can't hide behind several good averages.
  // Missing data is already scored conservatively; it isn't double-counted here.
  const measured = factors.filter((f) => f.known);
  const weakest = measured.length ? Math.min(...measured.map((f) => f.score)) : weighted;

  const caps: string[] = [];
  let score = WEIGHTED_SHARE * weighted + (1 - WEIGHTED_SHARE) * weakest;
  for (const rule of CAP_RULES) {
    if (rule.applies(opportunity, now) && score > rule.ceiling) {
      score = rule.ceiling;
      caps.push(rule.reason);
    }
  }
  const unknownCount = factors.length - measured.length;
  if (unknownCount >= UNKNOWN_FACTOR_CAP.threshold && score > UNKNOWN_FACTOR_CAP.ceiling) {
    score = UNKNOWN_FACTOR_CAP.ceiling;
    caps.push(UNKNOWN_FACTOR_CAP.reason);
  }
  score = Math.round(score);

  const grade = gradeFromScore(score);
  return {
    ...grade,
    score,
    summary: GRADE_SUMMARIES[grade.grade],
    reasons: buildReasons(factors, caps),
    factors,
    caps,
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

/** Strongest strengths and weaknesses, in plain English. */
function buildReasons(factors: FactorAssessment[], caps: string[]): string[] {
  const byContribution = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const strengths = byContribution.filter((f) => f.impact === "positive").slice(0, 2);
  const weaknesses = [...factors]
    .filter((f) => f.impact !== "positive")
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);
  return [...caps, ...weaknesses.map((f) => f.detail), ...strengths.map((f) => f.detail)];
}

export function rateOpportunity(opportunity: Opportunity, options?: SafetyGradeOptions): RatedOpportunity {
  return { ...opportunity, safety: calculateSafetyGrade(opportunity, options) };
}

export function rateOpportunities(list: readonly Opportunity[], options?: SafetyGradeOptions): RatedOpportunity[] {
  return list.map((o) => rateOpportunity(o, options));
}
