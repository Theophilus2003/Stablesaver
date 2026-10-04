import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "./cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-fg-muted",
        positive: "border-positive/20 bg-positive/10 text-positive",
        warning: "border-warning/25 bg-warning/10 text-warning",
        danger: "border-danger/25 bg-danger/10 text-danger",
        info: "border-info/25 bg-info/10 text-info",
        solid: "border-transparent bg-fg text-canvas",
      },
      size: {
        xs: "h-5 px-2 text-[10px] uppercase tracking-[0.08em]",
        sm: "h-6 px-2.5 text-[11px]",
        md: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/** Small status dot; `pulse` for live states. */
export function StatusDot({
  tone = "positive",
  pulse = false,
  className,
}: {
  tone?: "positive" | "warning" | "danger" | "neutral" | "info";
  pulse?: boolean;
  className?: string;
}) {
  const color = {
    positive: "bg-positive",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-fg-subtle",
    info: "bg-info",
  }[tone];
  return (
    <span className={cn("relative inline-flex size-1.5 shrink-0", className)} aria-hidden>
      {pulse ? <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", color)} /> : null}
      <span className={cn("relative inline-flex size-1.5 rounded-full", color)} />
    </span>
  );
}
