import type { DistanceUnit } from "./types";

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Pace as min:sec per unit, e.g. "9:42" */
export function formatPace(durationSec: number, distance: number): string {
  if (!distance || distance <= 0) return "—";
  return formatDuration(durationSec / distance);
}

export function speed(durationSec: number, distance: number): number {
  if (!durationSec) return 0;
  return distance / (durationSec / 3600);
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function speedUnit(u: DistanceUnit) {
  return u === "mi" ? "mph" : "km/h";
}

export function convertDistance(d: number, from: DistanceUnit, to: DistanceUnit) {
  if (from === to) return d;
  return from === "mi" ? d * 1.609344 : d / 1.609344;
}

export function formatDate(ts: number, opts?: Intl.DateTimeFormatOptions) {
  return new Date(ts).toLocaleDateString(undefined, opts ?? {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Sunday 00:00 of the week containing ts (weeks run Sunday–Saturday) */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
