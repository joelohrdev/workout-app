import type { Dumbbells } from "./types";

/** Every per-hand weight you can load, ascending. */
export function availableWeights(d: Dumbbells): number[] {
  if (d.mode === "fixed") return [...new Set(d.weights.filter((w) => w > 0))].sort((a, b) => a - b);
  const out: number[] = [];
  if (d.step <= 0 || d.max < d.min) return out;
  for (let w = d.min; w <= d.max + 1e-9 && out.length < 500; w += d.step) out.push(Math.round(w * 100) / 100);
  return out;
}

/** Closest weight you own to `w` (prefers the lighter one on ties). */
export function nearestWeight(d: Dumbbells, w: number): number {
  const list = availableWeights(d);
  if (!list.length) return w;
  return list.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), list[0]);
}

/** The next weight up from `w`, or `w` if you're already at your heaviest. */
export function nextWeightUp(d: Dumbbells, w: number): number {
  const list = availableWeights(d);
  return list.find((x) => x > w + 1e-9) ?? w;
}

export function describeDumbbells(d: Dumbbells, unit: string): string {
  if (d.mode === "adjustable") return `${d.min}–${d.max} ${unit} in ${d.step} ${unit} steps`;
  const list = availableWeights(d);
  return list.length ? `${list.join(", ")} ${unit}` : "None set";
}
