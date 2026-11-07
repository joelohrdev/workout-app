"use client";

import { useMemo, useState } from "react";
import { EXERCISES, MUSCLE_LABEL, MUSCLE_ORDER } from "@/lib/exercises";
import { uid, update, useDB } from "@/lib/store";
import type { Exercise, Muscle } from "@/lib/types";
import { PlusIcon, RunIcon } from "./Icons";
import { Button, Sheet } from "./ui";

export function ExercisePicker({
  open,
  onClose,
  onPick,
  onPickTreadmill,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ex: Exercise) => void;
  onPickTreadmill?: () => void;
}) {
  const db = useDB();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [muscle, setMuscle] = useState<Muscle>("chest");
  const [weighted, setWeighted] = useState(true);

  const all = useMemo(() => [...EXERCISES, ...db.customExercises], [db.customExercises]);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? all.filter((e) => e.name.toLowerCase().includes(needle)) : all;
    return MUSCLE_ORDER.map((m) => ({ m, items: list.filter((e) => e.muscle === m) })).filter(
      (g) => g.items.length,
    );
  }, [all, q]);

  const pick = (ex: Exercise) => {
    onPick(ex);
    setQ("");
    onClose();
  };

  const create = () => {
    const ex: Exercise = {
      id: `custom-${uid()}`,
      name: q.trim(),
      muscle,
      equipment: weighted ? ["dumbbell"] : ["bodyweight"],
      custom: true,
    };
    update((d) => ({ ...d, customExercises: [...d.customExercises, ex] }));
    setCreating(false);
    pick(ex);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search or name a new exercise"
        className="sticky top-0 h-12 w-full rounded-xl bg-surface-2 px-4 outline-none focus:ring-2 focus:ring-accent"
      />

      {onPickTreadmill && !q && (
        <button
          onClick={() => {
            onPickTreadmill();
            onClose();
          }}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-cardio/30 bg-cardio/10 p-3 text-left font-semibold"
        >
          <RunIcon className="text-cardio" /> Treadmill block
        </button>
      )}

      {q.trim() && (
        <div className="mt-3 rounded-xl border border-dashed border-line p-3">
          {!creating ? (
            <button className="flex w-full items-center gap-2 font-semibold text-accent" onClick={() => setCreating(true)}>
              <PlusIcon width={18} height={18} /> Create “{q.trim()}”
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_ORDER.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMuscle(m)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      muscle === m ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {MUSCLE_LABEL[m]}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
                Uses dumbbells (track weight)
              </label>
              <Button onClick={create}>Create &amp; add</Button>
            </div>
          )}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.m} className="mt-5">
          <p className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{MUSCLE_LABEL[g.m]}</p>
          <ul className="overflow-hidden rounded-xl border border-line">
            {g.items.map((ex) => (
              <li key={ex.id} className="border-b border-line last:border-0">
                <button onClick={() => pick(ex)} className="flex w-full items-center justify-between px-3 py-3 text-left hover:bg-surface-2">
                  <span>{ex.name}</span>
                  <span className="text-xs text-muted">
                    {ex.equipment.filter((e) => e !== "bodyweight").join(" + ") || "bodyweight"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Sheet>
  );
}
