"use client";

import { motion } from "motion/react";
import * as React from "react";
import { cn } from "./cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Accessible name for the group. */
  label: string;
  size?: "md" | "lg";
  className?: string;
}

/**
 * Radio-group semantics with a sliding indicator. Arrow keys move the
 * selection, matching native radio behaviour.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const id = React.useId();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  function move(from: number, delta: number) {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const at = enabled.indexOf(from);
    const next = enabled[(at + delta + enabled.length) % enabled.length];
    if (next === undefined) return;
    onValueChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("relative grid rounded-full border border-line bg-surface-2 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(index, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "relative z-0 rounded-full font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg/40 disabled:opacity-40",
              size === "lg" ? "h-11 px-3 text-[14px] sm:text-[15px]" : "h-9 px-3 text-[13px]",
              selected ? "text-canvas" : "text-fg-muted hover:text-fg",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`${id}-indicator`}
                className="absolute inset-0 -z-10 rounded-full bg-fg shadow-[0_1px_2px_rgb(0_0_0/0.4)]"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Lighter pill tabs for filters (sort modes, networks). */
export function PillTabs<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("scrollbar-none flex gap-1.5 overflow-x-auto [mask-image:linear-gradient(90deg,#000_92%,transparent)] sm:[mask-image:none]", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg/40 disabled:cursor-not-allowed",
              selected
                ? "border-line-strong bg-surface-3 text-fg"
                : "border-transparent text-fg-muted hover:text-fg disabled:hover:text-fg-muted",
              option.disabled && "opacity-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
