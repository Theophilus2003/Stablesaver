"use client";

import { motion } from "motion/react";
import { cn } from "./cn";
import { PROTOCOL_COLORS } from "./protocol-mark";

export interface AllocationSegment {
  id: string;
  label: string;
  /** 0..1 */
  share: number;
}

/** Stacked horizontal bar with 2px gaps between segments. */
export function AllocationBar({
  segments,
  className,
  height = 8,
}: {
  segments: AllocationSegment[];
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn("flex w-full gap-[2px] overflow-hidden rounded-full", className)}
      style={{ height }}
      role="img"
      aria-label={segments.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(", ")}
    >
      {segments.map((s) => (
        <motion.div
          key={s.id}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ backgroundColor: PROTOCOL_COLORS[s.id] ?? "#888" }}
          initial={false}
          animate={{ flexGrow: s.share }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
        />
      ))}
    </div>
  );
}

export function AllocationLegend({
  segments,
  className,
  values,
}: {
  segments: AllocationSegment[];
  className?: string;
  /** Optional right-aligned value per segment id. */
  values?: Record<string, string>;
}) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {segments.map((s) => (
        <li key={s.id} className="flex items-center gap-2.5 text-sm">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS[s.id] ?? "#888" }} />
          <span className="text-fg">{s.label}</span>
          <span className="ml-auto tabular-nums text-fg-muted">
            {values?.[s.id] ?? `${Math.round(s.share * 100)}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}
