"use client";

import { formatDate } from "@/lib/format";

/** Small responsive line chart for a series over time. */
export function LineChart({
  points,
  unit,
  color = "var(--accent)",
  digits = 0,
}: {
  points: { t: number; v: number }[];
  unit?: string;
  color?: string;
  digits?: number;
}) {
  if (points.length < 2)
    return <p className="py-6 text-center text-sm text-muted">Log this at least twice to see a trend.</p>;
  const W = 320;
  const H = 120;
  const PAD = { l: 4, r: 4, t: 10, b: 18 };
  const vs = points.map((p) => p.v);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const t0 = points[0].t;
  const t1 = points.at(-1)!.t;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const fmt = (v: number) => `${v.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
  return (
    <figure>
      <div className="flex justify-between text-xs text-muted">
        <span>low {fmt(Math.min(...vs))}</span>
        <span>high {fmt(Math.max(...vs))}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label="Trend chart">
        <line x1={0} x2={W} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--line)" />
        <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.v)} r={points.length > 30 ? 1.5 : 3} fill={color} />
        ))}
        <text x={0} y={H - 3} fontSize={10} fill="var(--muted)">
          {formatDate(t0, { month: "short", day: "numeric" })}
        </text>
        <text x={W} y={H - 3} fontSize={10} fill="var(--muted)" textAnchor="end">
          {formatDate(t1, { month: "short", day: "numeric" })}
        </text>
      </svg>
    </figure>
  );
}
