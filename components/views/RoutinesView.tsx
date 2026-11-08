"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { findExercise } from "@/lib/exercises";
import { uid, update, useDB, useHydrated } from "@/lib/store";
import type { Routine, RoutineItem } from "@/lib/types";
import { groupLabels, startSession } from "@/lib/workout";
import { ExercisePicker } from "../ExercisePicker";
import { DownIcon, DumbbellIcon, PlayIcon, PlusIcon, RunIcon, TrashIcon, UpIcon } from "../Icons";
import { Button, Card, PageHeader, Sheet, Stepper } from "../ui";

export function RoutinesView() {
  const db = useDB();
  const hydrated = useHydrated();
  const router = useRouter();
  const [editing, setEditing] = useState<Routine | null>(null);

  const start = (r: Routine) => {
    if (db.activeSession && !confirm("A workout is already in progress. Replace it?")) return;
    startSession(r);
    router.push("/workout");
  };

  const save = (r: Routine) => {
    update((d) => {
      const exists = d.routines.some((x) => x.id === r.id);
      return {
        ...d,
        routines: exists ? d.routines.map((x) => (x.id === r.id ? r : x)) : [...d.routines, r],
      };
    });
    setEditing(null);
  };

  const remove = (r: Routine) => {
    if (!confirm(`Delete “${r.name}”?`)) return;
    update((d) => ({ ...d, routines: d.routines.filter((x) => x.id !== r.id) }));
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="Routines"
        action={
          <Button size="sm" onClick={() => setEditing({ id: uid(), name: "", items: [], createdAt: Date.now() })}>
            <PlusIcon width={16} height={16} /> New
          </Button>
        }
      />

      {!hydrated ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      ) : db.routines.length === 0 ? (
        <Card className="text-center text-muted">No routines yet. Tap New to build one.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {db.routines.map((r) => {
            const strength = r.items.filter((i) => i.kind === "strength");
            const cardioMin = r.items.reduce((n, i) => n + (i.kind === "treadmill" ? i.minutes : 0), 0);
            const sets = strength.reduce((n, i) => n + (i.kind === "strength" ? i.sets : 0), 0);
            return (
              <li key={r.id}>
                <Card>
                  <button className="w-full text-left" onClick={() => setEditing(structuredClone(r))}>
                    <h2 className="font-display text-2xl leading-tight font-bold uppercase">{r.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {strength.length} exercises · {sets} sets
                      {cardioMin ? ` · ${cardioMin} min treadmill` : ""}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted/80">
                      {r.items
                        .map((i) =>
                          i.kind === "treadmill" ? "Treadmill" : findExercise(i.exerciseId, db.customExercises).name,
                        )
                        .join(" · ")}
                    </p>
                  </button>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1" onClick={() => start(r)} disabled={!r.items.length}>
                      <PlayIcon width={16} height={16} /> Start
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(structuredClone(r))}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => save({ ...structuredClone(r), id: uid(), name: `${r.name} (copy)`, createdAt: Date.now() })}
                    >
                      Copy
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <RoutineEditor
          key={editing.id}
          initial={editing}
          isNew={!db.routines.some((r) => r.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </>
  );
}

function RoutineEditor({
  initial,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: Routine;
  isNew: boolean;
  onCancel: () => void;
  onSave: (r: Routine) => void;
  onDelete: (r: Routine) => void;
}) {
  const db = useDB();
  const [r, setR] = useState(initial);
  const [picking, setPicking] = useState(false);

  const setItem = (i: number, patch: Partial<RoutineItem>) =>
    setR((x) => ({
      ...x,
      items: x.items.map((it, j) => (j === i ? ({ ...it, ...patch } as RoutineItem) : it)),
    }));
  const move = (i: number, dir: -1 | 1) =>
    setR((x) => {
      const items = [...x.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return x;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...x, items: tidyGroups(items) };
    });
  const removeItem = (i: number) =>
    setR((x) => ({ ...x, items: tidyGroups(x.items.filter((_, j) => j !== i)) }));
  const add = (item: RoutineItem) => setR((x) => ({ ...x, items: [...x.items, item] }));

  const linked = (i: number) => {
    const a = r.items[i];
    const b = r.items[i + 1];
    return a?.kind === "strength" && b?.kind === "strength" && !!a.group && a.group === b.group;
  };
  /** Join or split items i and i+1 as a superset. */
  const toggleLink = (i: number) =>
    setR((x) => {
      const items = x.items.map((it) => ({ ...it })) as RoutineItem[];
      const a = items[i];
      const b = items[i + 1];
      if (a.kind !== "strength" || b.kind !== "strength") return x;
      if (a.group && a.group === b.group) {
        // split: everything after the boundary in this group gets a new group
        const old = a.group;
        const fresh = uid();
        for (let j = i + 1; j < items.length; j++) {
          const it = items[j];
          if (it.kind === "strength" && it.group === old) it.group = fresh;
          else break;
        }
      } else {
        const g = a.group ?? b.group ?? uid();
        const from = b.group;
        a.group = g;
        for (const it of items) if (it.kind === "strength" && from && it.group === from) it.group = g;
        b.group = g;
      }
      return { ...x, items: tidyGroups(items) };
    });
  const labels = groupLabels(r.items);

  return (
    <Sheet open onClose={onCancel} title={isNew ? "New routine" : "Edit routine"}>
      <input
        value={r.name}
        onChange={(e) => setR({ ...r, name: e.target.value })}
        placeholder="Routine name, e.g. Upper Body"
        className="h-12 w-full rounded-xl bg-surface-2 px-4 text-lg font-semibold outline-none focus:ring-2 focus:ring-accent"
      />

      <ol className="mt-4 flex flex-col gap-3">
        {r.items.map((it, i) => (
          <li key={i} className="flex flex-col gap-3">
            <div
              className={`rounded-xl border bg-bg/40 p-3 ${
                it.kind === "strength" && it.group && labels.has(it.group) ? "border-accent/50" : "border-line"
              }`}
            >
            {it.kind === "strength" && it.group && labels.has(it.group) && (
              <p className="mb-1 text-[11px] font-bold tracking-[0.12em] text-accent uppercase">
                Superset {labels.get(it.group)}
              </p>
            )}
            <div className="flex items-center gap-2">
              {it.kind === "treadmill" ? (
                <RunIcon width={18} height={18} className="shrink-0 text-cardio" />
              ) : (
                <DumbbellIcon width={18} height={18} className="shrink-0 text-accent" />
              )}
              <p className="min-w-0 flex-1 truncate font-semibold">
                {it.kind === "treadmill" ? "Treadmill" : findExercise(it.exerciseId, db.customExercises).name}
              </p>
              <button aria-label="Move up" onClick={() => move(i, -1)} className="p-1.5 text-muted"><UpIcon width={18} height={18} /></button>
              <button aria-label="Move down" onClick={() => move(i, 1)} className="p-1.5 text-muted"><DownIcon width={18} height={18} /></button>
              <button aria-label="Remove" onClick={() => removeItem(i)} className="p-1.5 text-danger"><TrashIcon width={18} height={18} /></button>
            </div>
            {it.kind === "strength" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stepper label="Sets" value={it.sets} min={1} max={10} onChange={(n) => setItem(i, { sets: n })} />
                {findExercise(it.exerciseId, db.customExercises).timed ? (
                  <Stepper label="Seconds" value={it.reps} min={5} max={600} step={5} onChange={(n) => setItem(i, { reps: n })} />
                ) : (
                  <Stepper label="Reps" value={it.reps} min={1} max={100} onChange={(n) => setItem(i, { reps: n })} />
                )}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-[8rem_1fr] gap-2">
                <Stepper label="Minutes" value={it.minutes} min={1} max={180} onChange={(n) => setItem(i, { minutes: n })} />
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Note</span>
                  <input
                    value={it.note ?? ""}
                    onChange={(e) => setItem(i, { note: e.target.value })}
                    placeholder="Warm-up, intervals…"
                    className="h-10 w-full min-w-0 rounded-xl bg-surface-2 px-3 text-sm outline-none"
                  />
                </label>
              </div>
            )}
            </div>
            {it.kind === "strength" && r.items[i + 1]?.kind === "strength" && (
              <button
                type="button"
                onClick={() => toggleLink(i)}
                className={`-my-1.5 self-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  linked(i) ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
                }`}
              >
                {linked(i) ? "⛓ Superset — tap to split" : "+ Superset with next"}
              </button>
            )}
          </li>
        ))}
      </ol>

      <Button variant="ghost" className="mt-3 w-full" onClick={() => setPicking(true)}>
        <PlusIcon width={18} height={18} /> Add exercise or treadmill
      </Button>

      <div className="mt-6 flex gap-2">
        {!isNew && (
          <Button variant="danger" onClick={() => onDelete(r)}>
            Delete
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!r.name.trim() || !r.items.length}
          onClick={() => onSave({ ...r, name: r.name.trim() })}
        >
          Save routine
        </Button>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ex) =>
          add({ kind: "strength", exerciseId: ex.id, sets: 3, reps: ex.timed ? 30 : 10, restSec: 90 })
        }
        onPickTreadmill={() => add({ kind: "treadmill", minutes: 10 })}
      />
    </Sheet>
  );
}

/** Drop superset ids that no longer join two neighbouring exercises. */
function tidyGroups(items: RoutineItem[]): RoutineItem[] {
  return items.map((it, i) => {
    if (it.kind !== "strength" || !it.group) return it;
    const prev = items[i - 1];
    const next = items[i + 1];
    const joined =
      (prev?.kind === "strength" && prev.group === it.group) || (next?.kind === "strength" && next.group === it.group);
    if (joined) return it;
    const { group: _drop, ...rest } = it;
    void _drop;
    return rest;
  });
}
