import * as React from "react";
import { cn } from "./cn";

type GradeLetter = "A" | "B" | "C" | "D";

const GRADE_STYLES: Record<GradeLetter, string> = {
  A: "text-grade-a bg-grade-a/12 border-grade-a/25",
  B: "text-grade-b bg-grade-b/12 border-grade-b/25",
  C: "text-grade-c bg-grade-c/12 border-grade-c/25",
  D: "text-grade-d bg-grade-d/12 border-grade-d/25",
};

const SIZES = {
  xs: "size-[18px] text-[10px] rounded-full",
  sm: "h-6 min-w-6 px-1.5 text-xs rounded-[7px]",
  md: "h-7 min-w-7 px-1.5 text-[13px] rounded-lg",
  lg: "h-10 min-w-10 px-2 text-lg rounded-xl",
  xl: "h-14 min-w-14 px-3 text-2xl rounded-2xl",
} as const;

export interface GradeBadgeProps {
  /** e.g. "A", "A-", "B+" */
  grade: string;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}

/** A–D safety grade chip. Colour follows the letter; modifiers are shown as text. */
export function GradeBadge({ grade, size = "md", className, title }: GradeBadgeProps) {
  const letter = (grade.charAt(0).toUpperCase() as GradeLetter) ?? "D";
  const modifier = grade.slice(1).replace("-", "−");
  return (
    <span
      title={title ?? `StableSave safety grade ${grade}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border font-semibold tabular-nums tracking-tight",
        GRADE_STYLES[letter] ?? GRADE_STYLES.D,
        SIZES[size],
        className,
      )}
    >
      {letter}
      {modifier ? <span className="ml-px text-[0.8em] font-medium">{modifier}</span> : null}
    </span>
  );
}
