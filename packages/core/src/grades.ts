import type { Grade, GradeModifier } from "./types";

interface GradeBand {
  min: number;
  grade: Grade;
  modifier: GradeModifier;
}

/**
 * Score → grade bands. There is deliberately no "A+": nothing in DeFi is
 * risk-free, and the top of the scale should not suggest otherwise.
 */
export const GRADE_BANDS: readonly GradeBand[] = [
  { min: 85, grade: "A", modifier: "" },
  { min: 80, grade: "A", modifier: "-" },
  { min: 75, grade: "B", modifier: "+" },
  { min: 70, grade: "B", modifier: "" },
  { min: 65, grade: "B", modifier: "-" },
  { min: 60, grade: "C", modifier: "+" },
  { min: 55, grade: "C", modifier: "" },
  { min: 50, grade: "C", modifier: "-" },
  { min: 0, grade: "D", modifier: "" },
];

export const GRADE_LABELS: Record<Grade, string> = {
  A: "Safer",
  B: "Moderate",
  C: "Riskier",
  D: "High risk",
};

export const GRADE_SUMMARIES: Record<Grade, string> = {
  A: "Lower relative risk based on protocol maturity, liquidity, strategy complexity and current risk factors.",
  B: "Moderate relative risk. Solid fundamentals, with a few factors worth keeping an eye on.",
  C: "Higher relative risk. More things could go wrong in exchange for the extra yield.",
  D: "Highest relative risk. Only consider this with money you can afford to lose.",
};

const GRADE_ORDER: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3 };

/** 0 for A … 3 for D. */
export function gradeRank(grade: Grade): number {
  return GRADE_ORDER[grade];
}

/** True when `grade` is at least as safe as `minimum`. */
export function meetsGrade(grade: Grade, minimum: Grade): boolean {
  return gradeRank(grade) <= gradeRank(minimum);
}

export function gradeFromScore(score: number): {
  grade: Grade;
  modifier: GradeModifier;
  display: string;
  label: string;
} {
  const clamped = Math.max(0, Math.min(100, score));
  const band = GRADE_BANDS.find((b) => clamped >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]!;
  return {
    grade: band.grade,
    modifier: band.modifier,
    display: `${band.grade}${band.modifier}`,
    label: GRADE_LABELS[band.grade],
  };
}

/** Highest score that still maps to `grade` + `modifier`; used for caps. */
export function maxScoreFor(grade: Grade, modifier: GradeModifier = ""): number {
  const index = GRADE_BANDS.findIndex((b) => b.grade === grade && b.modifier === modifier);
  if (index <= 0) return 100;
  return GRADE_BANDS[index - 1]!.min - 1;
}
