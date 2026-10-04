"use client";

import { animate, useReducedMotion } from "motion/react";
import * as React from "react";

export interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  /** Seconds. Kept short: numbers should settle, not perform. */
  duration?: number;
  className?: string;
}

/**
 * Tweens between values when they change. Renders the final value on the
 * server and for users who prefer reduced motion.
 */
export function AnimatedNumber({ value, format, duration = 0.45, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const previous = React.useRef(value);
  const formatRef = React.useRef(format);
  formatRef.current = format;

  React.useEffect(() => {
    const node = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!node) return;
    if (reduce || from === value || !Number.isFinite(from)) {
      node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = formatRef.current(latest);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
