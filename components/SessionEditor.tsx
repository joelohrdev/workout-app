"use client";

import { useState } from "react";
import { findExercise, isBodyweight } from "@/lib/exercises";
import { update, useDB } from "@/lib/store";
import type { Session, SessionStrength } from "@/lib/types";
import { TrashIcon } from "./Icons";
import { Button, NumberInput, Sheet } from "./ui";

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Fix up a finished workout: sets, weights, reps, notes, effort, date. */
export function SessionEditor({ session, onClose }: { session: Session; onClose: () => void }) {
  const db = useDB();
  const unit = db.settings.weightUnit;
  const [s, setS] = useState<Session>(() => structuredClone(session));
  const durationMin = Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 60000);

  const patchItem = (i: number, fn: (it: SessionStrength) => SessionStrength) =>
    setS((x) => ({
      ...x,
      items: x.items.map((it, j) => (j === i && it.kind === "strength" ? fn(it) : it)),
    }));

  const save = () => {
    const cleaned: Session = {
      ...s,
      name: s.name.trim() || session.name,
      // drop exercises with no sets left
      items: s.items.filter((it) => it.kind !== "strength" || it.sets.length > 0),
    };
    update((d) => ({ ...d, sessions: d.sessions.map((x) => (x.id === cleaned.id ? cleaned : x)).sort((a, b) => a.startedAt - b.startedAt) }));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Edit workout">
      <div className="flex flex-col gap-3">
        <input
          aria-label="Workout name"
          value={s.name}
          onChange={(e) => setS({ ...s, name: e.target.value })}
          className="h-11 rounded-xl bg-surface-2 px-3 font-semibold outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Started</span>
            <input
              type="datetime-local"
              value={toLocalInput(s.startedAt)}
              onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (!Number.isFinite(t)) return;
                const len = (s.endedAt ?? s.startedAt) - s.startedAt;
                setS({ ...s, startedAt: t, endedAt: t + len });
              }}
              className="h-11 w-full min-w-0 rounded-xl bg-surface-2 px-3 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Minutes</span>
            <NumberInput
              ariaLabel="Duration in minutes"
              decimal={false}
              value={durationMin}
              onChange={(v) => setS({ ...s, endedAt: s.startedAt + (v ?? 0) * 60000 })}
            />
          </label>
        </div>

        {s.items.map((it, i) => {
          if (it.kind !== "strength") return null;
          const ex = findExercise(it.exerciseId, db.customExercises);
          const bw = isBodyweight(ex);
          return (
            <div key={i} className="rounded-xl border border-line p-3">
              <p className="font-semibold">{ex.name}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {it.sets.map((set, si) => (
                  <li key={si} className="grid grid-cols-[1.5rem_1fr_1fr_2.5rem] items-center gap-2">
                    <span className="tabular text-sm text-muted">{si + 1}</span>
                    {bw ? (
                      <span className="text-center text-sm text-muted">BW</span>
                    ) : (
                      <NumberInput
                        ariaLabel={`${ex.name} set ${si + 1} weight (${unit})`}
                        value={set.weight}
                        placeholder={unit}
                        onChange={(v) => patchItem(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? { ...y, weight: v } : y)) }))}
                      />
                    )}
                    <NumberInput
                      ariaLabel={`${ex.name} set ${si + 1} ${ex.timed ? "seconds" : "reps"}`}
                      decimal={false}
                      value={set.reps}
                      placeholder={ex.timed ? "sec" : "reps"}
                      onChange={(v) => patchItem(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === si ? { ...y, reps: v } : y)) }))}
                    />
                    <button
                      aria-label={`Delete ${ex.name} set ${si + 1}`}
                      onClick={() => patchItem(i, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== si) }))}
                      className="grid h-11 place-items-center text-muted"
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-3">
                <button
                  className="text-sm font-semibold text-accent"
                  onClick={() =>
                    patchItem(i, (x) => {
                      const prev = x.sets.at(-1);
                      return { ...x, sets: [...x.sets, { reps: prev?.reps ?? 10, weight: prev?.weight ?? null, targetReps: prev?.targetReps ?? 10, done: true }] };
                    })
                  }
                >
                  + Add set
                </button>
              </div>
              <input
                aria-label={`Note for ${ex.name}`}
                value={it.note ?? ""}
                onChange={(e) => patchItem(i, (x) => ({ ...x, note: e.target.value }))}
                placeholder="Note"
                className="mt-2 h-10 w-full rounded-xl bg-surface-2 px-3 text-sm outline-none"
              />
            </div>
          );
        })}

        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Effort</p>
          <div className="mt-1 grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
              <button
                key={n}
                aria-label={`Effort ${n} of 10`}
                aria-pressed={s.effort === n}
                onClick={() => setS({ ...s, effort: s.effort === n ? null : n })}
                className={`tabular h-9 rounded-lg text-sm font-bold ${s.effort === n ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <textarea
          aria-label="Workout note"
          value={s.note ?? ""}
          onChange={(e) => setS({ ...s, note: e.target.value })}
          placeholder="Workout notes"
          rows={2}
          className="resize-none rounded-xl bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <Button size="lg" onClick={save}>
          Save changes
        </Button>
      </div>
    </Sheet>
  );
}
