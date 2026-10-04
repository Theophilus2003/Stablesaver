"use client";

import { cn } from "@stablesave/ui";
import * as React from "react";
import type { HistoryPoint } from "@/lib/vault/portfolio";
import { formatEarnings } from "@/lib/format";

const HEIGHT = 180;
const PAD = { top: 16, right: 56, bottom: 26, left: 8 };

function niceStep(max: number, ticks = 3): number {
  const raw = max / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dateFmtLong = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Cumulative earnings over time. Single series: 2px line, ~10% area wash,
 * hairline grid, crosshair + tooltip on hover/keyboard, value at the line end,
 * and a hidden table for screen readers.
 */
export function EarningsChart({ points, className }: { points: HistoryPoint[]; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [active, setActive] = React.useState<number | null>(null);
  const gradientId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div className={cn("flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-line text-sm text-fg-subtle", className)}>
        Your earnings will show here after your first deposit.
      </div>
    );
  }

  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const maxEarned = Math.max(...points.map((p) => p.earned), 0.01);
  const step = niceStep(maxEarned);
  const yMax = Math.ceil(maxEarned / step) * step;
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + innerH - (Math.max(0, v) / yMax) * innerH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.earned).toFixed(1)}`).join("");
  const area = `${line}L${x(t1).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const xTicks = [t0, t0 + (t1 - t0) / 2, t1];

  const last = points[points.length - 1]!;
  const activePoint = active !== null ? points[active] : null;

  function locate(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    const t = t0 + ((px - PAD.left) / innerW) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i]!.t - t) < Math.abs(points[best]!.t - t)) best = i;
    }
    setActive(best);
  }

  return (
    <div ref={ref} className={cn("relative w-full min-w-0 select-none", className)}>
      <svg
        viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
        height={HEIGHT}
        role="img"
        aria-label={`Earnings over time: ${formatEarnings(last.earned)} earned since ${dateFmtLong.format(t0)}.`}
        tabIndex={0}
        className="block w-full touch-pan-y outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-fg/30"
        onPointerMove={(e) => locate(e.clientX)}
        onPointerDown={(e) => locate(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setActive((i) => {
              const cur = i ?? points.length - 1;
              return Math.max(0, Math.min(points.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
            });
          }
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-positive)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-positive)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid + y ticks (right side, recessive) */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left + innerW + 8} y={y(v)} dy="0.32em" fontSize={11} fill="var(--color-fg-subtle)" className="tabular-nums">
              ${v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 })}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={HEIGHT - 6}
            fontSize={11}
            fill="var(--color-fg-subtle)"
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
          >
            {dateFmt.format(t)}
          </text>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="var(--color-positive)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* End value */}
        {!activePoint ? (
          <circle cx={x(last.t)} cy={y(last.earned)} r={4} fill="var(--color-positive)" stroke="var(--color-surface)" strokeWidth={2} />
        ) : null}

        {activePoint ? (
          <g>
            <line
              x1={x(activePoint.t)}
              x2={x(activePoint.t)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--color-line-strong)"
              strokeWidth={1}
            />
            <circle cx={x(activePoint.t)} cy={y(activePoint.earned)} r={4.5} fill="var(--color-positive)" stroke="var(--color-surface)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-line bg-surface-3 px-3 py-2 shadow-lg"
          style={{ left: Math.min(Math.max(x(activePoint.t), 70), width - 70) }}
        >
          <div className="text-sm font-semibold tabular-nums text-fg">{formatEarnings(activePoint.earned)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span className="h-0.5 w-2.5 rounded-full bg-positive" aria-hidden />
            Earned · {dateFmtLong.format(activePoint.t)}
          </div>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>Cumulative earnings</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Earned</th>
            <th scope="col">Balance</th>
          </tr>
        </thead>
        <tbody>
          {points.filter((_, i) => i % 10 === 0 || i === points.length - 1).map((p) => (
            <tr key={p.t}>
              <td>{dateFmtLong.format(p.t)}</td>
              <td>{formatEarnings(p.earned)}</td>
              <td>${p.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
