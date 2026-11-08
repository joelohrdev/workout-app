import { findExercise } from "./exercises";
import type { DB } from "./types";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

const iso = (ts: number) => new Date(ts).toISOString();

/** One row per logged set. */
export function setsCsv(db: DB): string {
  const rows: unknown[][] = [];
  for (const s of db.sessions)
    for (const it of s.items) {
      if (it.kind !== "strength") continue;
      const ex = findExercise(it.exerciseId, db.customExercises);
      it.sets.forEach((set, i) =>
        rows.push([
          iso(s.startedAt),
          s.name,
          ex.name,
          ex.muscle,
          i + 1,
          set.weight,
          set.weight ? db.settings.weightUnit : "",
          ex.timed ? "" : set.reps,
          ex.timed ? set.reps : "",
          s.effort ?? "",
          it.note ?? "",
        ]),
      );
    }
  return toCsv(
    ["date", "workout", "exercise", "muscle", "set", "weight", "weight_unit", "reps", "seconds", "workout_effort", "note"],
    rows,
  );
}

export function runsCsv(db: DB): string {
  return toCsv(
    ["date", "distance", "unit", "duration_sec", "pace_sec_per_unit", "incline", "plan", "from_workout", "notes"],
    db.cardio.map((c) => [
      iso(c.date),
      c.distance,
      c.unit,
      c.durationSec,
      c.distance ? Math.round(c.durationSec / c.distance) : "",
      c.incline ?? "",
      c.planName ?? "",
      c.sessionId ? "yes" : "no",
      c.notes ?? "",
    ]),
  );
}

export function bodyCsv(db: DB): string {
  return toCsv(
    ["date", `weight_${db.settings.weightUnit}`, "waist", "chest", "arms", "hips", "thighs", `length_unit`, "note"],
    db.body.map((b) => [iso(b.date), b.weight, b.waist, b.chest, b.arms, b.hips, b.thighs, db.settings.lengthUnit, b.note ?? ""]),
  );
}

export function download(name: string, text: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
