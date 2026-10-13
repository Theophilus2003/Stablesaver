"use client";

import type { RatePoint } from "@stablesave/core";
import * as React from "react";

const HEIGHT = 156;
const PAD = { top: 12, right: 8, bottom: 12, left: 2 };

export interface RateChartProps {
  points: readonly RatePoint[];
  /** Index of the day being inspected, or null for "today". */
  activeIndex: number | null;
  onActiveIndexChange: (index: number | null) => void;
  /** Accessible summary of the chart. */
  label: string;
}

/**
 * One series of daily rates: a 2px line over a faint wash, an end dot for
 * today, and a crosshair that snaps to the nearest day under the pointer or
 * the arrow keys.
 */
export function RateChart({ points, activeIndex, onActiveIndexChange, label }: RateChartProps) {
  const ref = React.useRef<SVGSVGElement>(null);
  const [width, setWidth] = React.useState(0);
  const dragging = React.useRef(false);
  const gradientId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const geometry = React.useMemo(() => layout(points, width), [points, width]);

  const indexAt = (clientX: number) => {
    const el = ref.current;
    if (!el || !geometry || points.length === 0) return null;
    const x = clientX - el.getBoundingClientRect().left;
    const step = geometry.innerWidth / Math.max(1, points.length - 1);
    return Math.min(points.length - 1, Math.max(0, Math.round((x - PAD.left) / step)));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = points.length - 1;
    const current = activeIndex ?? last;
    let next: number | null = current;
    if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (event.key === "ArrowRight") next = Math.min(last, current + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Escape") next = null;
    else return;
    event.preventDefault();
    onActiveIndexChange(next);
  };

  const active = activeIndex !== null && geometry ? geometry.coords[activeIndex] : null;
  const end = geometry ? geometry.coords[geometry.coords.length - 1] : null;

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={label}
      tabIndex={0}
      width="100%"
      height={HEIGHT}
      viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
      className="block touch-pan-y select-none text-positive outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-fg/30"
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onActiveIndexChange(indexAt(event.clientX));
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" || dragging.current) onActiveIndexChange(indexAt(event.clientX));
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        if (event.pointerType !== "mouse") onActiveIndexChange(null);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onActiveIndexChange(null);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && !dragging.current) onActiveIndexChange(null);
      }}
      onKeyDown={onKeyDown}
      onBlur={() => onActiveIndexChange(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {geometry ? (
        <>
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={active ? 0.55 : 1}
          />
          {active ? (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={PAD.top - 6}
                y2={HEIGHT - 2}
                className="stroke-fg-subtle"
                strokeWidth={1}
              />
              <circle cx={active.x} cy={active.y} r={5} fill="currentColor" className="stroke-surface" strokeWidth={2} />
            </>
          ) : end ? (
            <>
              <circle cx={end.x} cy={end.y} r={9} fill="currentColor" opacity={0.18} />
              <circle cx={end.x} cy={end.y} r={4.5} fill="currentColor" className="stroke-surface" strokeWidth={2} />
            </>
          ) : null}
        </>
      ) : null}
    </svg>
  );
}

interface Geometry {
  coords: Array<{ x: number; y: number }>;
  line: string;
  area: string;
  innerWidth: number;
}

function layout(points: readonly RatePoint[], width: number): Geometry | null {
  if (width <= 0 || points.length < 2) return null;
  const values = points.map((p) => p.apy);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Small moves shouldn't look dramatic: pad the range, at least ±0.1 percentage points.
  const pad = Math.max((max - min) * 0.18, 0.001);
  const lo = min - pad;
  const hi = max + pad;
  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const coords = values.map((v, i) => ({
    x: PAD.left + (i / (values.length - 1)) * innerWidth,
    y: PAD.top + (1 - (v - lo) / (hi - lo)) * innerHeight,
  }));
  const line = monotonePath(coords);
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  const area = `${line} L${last.x.toFixed(2)},${HEIGHT} L${first.x.toFixed(2)},${HEIGHT} Z`;
  return { coords, line, area, innerWidth };
}

/** Monotone cubic interpolation (Fritsch–Carlson): smooth, and never overshoots the data. */
function monotonePath(pts: ReadonlyArray<{ x: number; y: number }>): string {
  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]!.x - pts[i]!.x);
    slope.push((pts[i + 1]!.y - pts[i]!.y) / dx[i]!);
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b));
  }
  tangent.push(slope[n - 2]!);
  let d = `M${pts[0]!.x.toFixed(2)},${pts[0]!.y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${(p.x + h).toFixed(2)},${(p.y + h * tangent[i]!).toFixed(2)} ${(q.x - h).toFixed(2)},${(q.y - h * tangent[i + 1]!).toFixed(2)} ${q.x.toFixed(2)},${q.y.toFixed(2)}`;
  }
  return d;
}
