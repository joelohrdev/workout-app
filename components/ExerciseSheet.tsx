"use client";

import { useMemo } from "react";
import { MUSCLE_LABEL, findExercise, isBodyweight } from "@/lib/exercises";
import { formatDate } from "@/lib/format";
import { useDB } from "@/lib/store";
import { bestE1rm } from "@/lib/workout";
import { LineChart } from "./LineChart";
import { Sheet, Stat } from "./ui";

/** Full history, records and trend for one exercise. */
export function ExerciseSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const db = useDB();
  const ex = exerciseId ? findExercise(exerciseId, db.customExercises) : null;
  const unit = db.settings.weightUnit;

  const entries = useMemo(() => {
    if (!exerciseId) return [];
    return db.sessions.flatMap((s) =>
      s.items.flatMap((it) =>
        it.kind === "strength" && it.exerciseId === exerciseId && it.sets.some((x) => x.done)
          ? [{ date: s.startedAt, sets: it.sets.filter((x) => x.done), note: it.note }]
          : [],
      ),
    );
  }, [db.sessions, exerciseId]);

  if (!ex) return null;
  const timed = !!ex.timed;
  const weighted = !isBodyweight(ex) && entries.some((e) => e.sets.some((x) => x.weight));
  const per = ex.unilateral ? "/side" : "";

  const heaviest = Math.max(0, ...entries.flatMap((e) => e.sets.map((x) => x.weight ?? 0)));
  const mostReps = Math.max(0, ...entries.flatMap((e) => e.sets.map((x) => x.reps ?? 0)));
  const bestE = Math.max(0, ...entries.map((e) => bestE1rm(e.sets)));
  const bestVolume = Math.max(
    0,
    ...entries.map((e) => e.sets.reduce((n, x) => n + (x.weight ?? 0) * (x.reps ?? 0), 0)),
  );
  const series = entries.map((e) => ({
    t: e.date,
    v: weighted ? bestE1rm(e.sets) : Math.max(...e.sets.map((x) => x.reps ?? 0)),
  }));

  return (
    <Sheet open onClose={onClose} title={ex.name}>
      <p className="mb-4 text-sm text-muted">
        {MUSCLE_LABEL[ex.muscle]} · {ex.equipment.join(" + ") || "bodyweight"}
        {ex.unilateral ? " · one side at a time" : ""}
      </p>
      {entries.length === 0 ? (
        <p className="py-8 text-center text-muted">You haven&apos;t logged this exercise yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Sessions" value={entries.length} />
            {weighted ? (
              <>
                <Stat label="Heaviest" value={heaviest} unit={unit} tone="accent" />
                <Stat label="Est. 1RM" value={Math.round(bestE)} unit={unit} />
              </>
            ) : (
              <Stat label={timed ? "Longest" : "Most reps"} value={mostReps} unit={timed ? `s${per}` : per || undefined} tone="accent" />
            )}
          </div>
          {weighted && bestVolume > 0 && (
            <p className="mt-2 text-sm text-muted">
              Best session volume: {Math.round(bestVolume).toLocaleString()} {unit}
            </p>
          )}
          <div className="mt-4 rounded-xl border border-line p-3">
            <p className="mb-1 text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              {weighted ? "Estimated 1-rep max" : timed ? "Longest hold" : "Best set"}
            </p>
            <LineChart points={series} unit={weighted ? unit : timed ? "s" : "reps"} />
          </div>
          <h3 className="mt-5 mb-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">History</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {entries
              .toReversed()
              .slice(0, 50)
              .map((e, i) => (
                <li key={i} className="px-3 py-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted">{formatDate(e.date)}</span>
                    <span className="tabular text-right">
                      {e.sets
                        .map((x) =>
                          timed ? `${x.reps}s` : x.weight ? `${x.weight}×${x.reps}` : `${x.reps}`,
                        )
                        .join("  ·  ")}
                    </span>
                  </div>
                  {e.note && <p className="mt-1 text-muted italic">“{e.note}”</p>}
                </li>
              ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
