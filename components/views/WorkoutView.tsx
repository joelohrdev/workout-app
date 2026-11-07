"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { findExercise, isBodyweight } from "@/lib/exercises";
import { formatDuration, round } from "@/lib/format";
import { useDB, useHydrated } from "@/lib/store";
import { beep, useNow, useWakeLock } from "@/lib/timers";
import type { DB, Session, SessionStrength, SessionTreadmill } from "@/lib/types";
import {
  discardActive,
  finishActive,
  lastPerformance,
  sessionSetCount,
  sessionVolume,
  suggestWeight,
  updateActive,
} from "@/lib/workout";
import { ExercisePicker } from "../ExercisePicker";
import { CheckIcon, DumbbellIcon, PlusIcon, RunIcon, TrashIcon, TrophyIcon } from "../Icons";
import { Stopwatch } from "../Stopwatch";
import { Button, Card, NumberInput, PageHeader } from "../ui";

export function WorkoutView() {
  const db = useDB();
  const hydrated = useHydrated();
  const router = useRouter();
  const s = db.activeSession;
  const now = useNow(!!s, 1000);
  const [picking, setPicking] = useState(false);
  const [summary, setSummary] = useState<Session | null>(null);
  // keep the screen on for the whole workout so the timers stay visible
  useWakeLock(!!s && !summary);

  if (!hydrated) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface" />;

  if (summary) return <Summary session={summary} db={db} onDone={() => router.push("/")} />;

  if (!s) {
    return (
      <>
        <PageHeader eyebrow="Workout" title="Nothing running" />
        <Card className="text-center">
          <p className="text-muted">Start a routine to begin logging sets.</p>
          <Link href="/routines" className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-semibold text-accent-ink">
            Choose a routine
          </Link>
        </Card>
      </>
    );
  }

  const done = s.items.reduce(
    (n, it) => n + (it.kind === "strength" ? it.sets.filter((x) => x.done).length : it.done ? 1 : 0),
    0,
  );
  const total = s.items.reduce((n, it) => n + (it.kind === "strength" ? it.sets.length : 1), 0);

  const finish = () => {
    if (done === 0 && !confirm("No sets checked off yet. Finish anyway?")) return;
    const saved = finishActive();
    if (saved) setSummary(saved);
  };

  return (
    <>
      <PageHeader eyebrow="Workout" title={s.name} />

      {/* total workout time, pinned to the top while scrolling */}
      <div className="pt-safe sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-lg">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Workout time</p>
            <p className="font-display tabular text-4xl leading-none font-bold">
              {now ? formatDuration((now - s.startedAt) / 1000) : "0:00"}
            </p>
          </div>
          <p className="tabular pb-0.5 text-sm text-muted">
            <span className="font-semibold text-text">{done}</span>/{total} done
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {s.items.map((it, i) =>
          it.kind === "strength" ? (
            <StrengthCard key={i} index={i} item={it} db={db} sessionId={s.id} />
          ) : (
            <TreadmillCard key={i} index={i} item={it} db={db} />
          ),
        )}
      </div>

      <Button variant="ghost" className="mt-3 w-full" onClick={() => setPicking(true)}>
        <PlusIcon width={18} height={18} /> Add exercise
      </Button>

      <div className="mt-6 flex gap-2">
        <Button
          variant="danger"
          size="lg"
          onClick={() => {
            if (confirm("Discard this workout? Nothing will be saved.")) {
              discardActive();
              router.push("/");
            }
          }}
        >
          Discard
        </Button>
        <Button size="lg" className="flex-1" onClick={finish}>
          Finish workout
        </Button>
      </div>

      {/* room so the floating rest timer never covers the finish button */}
      {s.restEndsAt && <div className="h-24" aria-hidden />}
      <RestTimer endsAt={s.restEndsAt} totalMs={s.restTotalMs ?? null} sound={db.settings.restSound} />

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ex) =>
          updateActive((x) => {
            const last = lastPerformance(db, ex.id);
            const { weight } = suggestWeight(last, db.settings.weightUnit);
            return {
              ...x,
              items: [
                ...x.items,
                {
                  kind: "strength",
                  exerciseId: ex.id,
                  restSec: 90,
                  sets: Array.from({ length: 3 }, () => ({ reps: 10, weight, targetReps: 10, done: false })),
                },
              ],
            };
          })
        }
        onPickTreadmill={() =>
          updateActive((x) => ({
            ...x,
            items: [
              ...x.items,
              { kind: "treadmill", targetMinutes: 10, timerId: `session-${x.id}-${x.items.length}`, distance: null, done: false },
            ],
          }))
        }
      />
    </>
  );
}

function patchItem<T extends Session["items"][number]>(index: number, fn: (it: T) => T) {
  updateActive((s) => ({
    ...s,
    items: s.items.map((it, j) => (j === index ? fn(it as T) : it)),
  }));
}

function StrengthCard({
  index,
  item,
  db,
  sessionId,
}: {
  index: number;
  item: SessionStrength;
  db: DB;
  sessionId: string;
}) {
  const ex = findExercise(item.exerciseId, db.customExercises);
  const bw = isBodyweight(ex);
  const unit = db.settings.weightUnit;
  const last = lastPerformance(db, item.exerciseId, sessionId);
  const sug = suggestWeight(last, unit);
  const allDone = item.sets.length > 0 && item.sets.every((x) => x.done);

  const setField = (si: number, patch: Partial<SessionStrength["sets"][number]>) =>
    patchItem<SessionStrength>(index, (it) => {
      const sets = it.sets.map((x, j) => (j === si ? { ...x, ...patch } : x));
      // carry a changed weight forward to later, untouched sets
      if (patch.weight !== undefined)
        for (let j = si + 1; j < sets.length; j++) if (!sets[j].done) sets[j] = { ...sets[j], weight: patch.weight };
      return { ...it, sets };
    });

  const toggle = (si: number) => {
    const willBeDone = !item.sets[si].done;
    setField(si, { done: willBeDone });
    const restMs = db.settings.restSec * 1000;
    if (willBeDone && restMs > 0)
      updateActive((s) => ({ ...s, restEndsAt: Date.now() + restMs, restTotalMs: restMs }));
  };

  return (
    <Card className={allDone ? "border-accent/40" : ""}>
      <div className="flex items-start gap-2">
        <DumbbellIcon width={18} height={18} className="mt-1 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{ex.name}</h2>
          {last ? (
            <p className="text-xs text-muted">
              Last:{" "}
              {last.sets
                .filter((x) => x.done)
                .map((x) => (bw || !x.weight ? `${x.reps} reps` : `${x.weight}×${x.reps}`))
                .join(", ")}
              {sug.bump && !bw && (
                <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">
                  ↑ try {sug.weight} {unit}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted">First time — pick a weight you can do for {item.sets[0]?.targetReps ?? 10} clean reps</p>
          )}
        </div>
        <button
          aria-label="Remove exercise"
          className="p-1 text-muted"
          onClick={() =>
            confirm(`Remove ${ex.name}?`) &&
            updateActive((s) => ({ ...s, items: s.items.filter((_, j) => j !== index) }))
          }
        >
          <TrashIcon width={16} height={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
        <span>Set</span>
        <span className="text-center">{bw ? "" : unit}</span>
        <span className="text-center">Reps</span>
        <span />
      </div>
      <ul className="mt-1 flex flex-col gap-2">
        {item.sets.map((set, si) => (
          <li key={si} className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2">
            <span className="font-display tabular text-xl font-bold text-muted">{si + 1}</span>
            {bw ? (
              <span className="text-center text-sm text-muted">BW</span>
            ) : (
              <NumberInput
                ariaLabel={`Set ${si + 1} weight`}
                value={set.weight}
                placeholder="—"
                onChange={(v) => setField(si, { weight: v })}
                className={set.done ? "opacity-60" : ""}
              />
            )}
            <NumberInput
              ariaLabel={`Set ${si + 1} reps`}
              value={set.reps}
              decimal={false}
              placeholder={String(set.targetReps)}
              onChange={(v) => setField(si, { reps: v })}
              className={set.done ? "opacity-60" : ""}
            />
            <button
              aria-label={set.done ? `Undo set ${si + 1}` : `Complete set ${si + 1}`}
              onClick={() => toggle(si)}
              className={`grid h-11 w-12 place-items-center rounded-xl transition active:scale-95 ${
                set.done ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"
              }`}
            >
              <CheckIcon width={20} height={20} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          className="text-sm font-semibold text-accent"
          onClick={() =>
            patchItem<SessionStrength>(index, (it) => {
              const prev = it.sets.at(-1);
              return {
                ...it,
                sets: [...it.sets, { reps: prev?.reps ?? 10, weight: prev?.weight ?? null, targetReps: prev?.targetReps ?? 10, done: false }],
              };
            })
          }
        >
          + Add set
        </button>
        {item.sets.length > 1 && (
          <button
            className="ml-auto text-sm text-muted"
            onClick={() => patchItem<SessionStrength>(index, (it) => ({ ...it, sets: it.sets.slice(0, -1) }))}
          >
            Remove last set
          </button>
        )}
      </div>
    </Card>
  );
}

function TreadmillCard({ index, item, db }: { index: number; item: SessionTreadmill; db: DB }) {
  const unit = db.settings.distanceUnit;
  return (
    <Card className={item.done ? "border-cardio/40" : ""}>
      <div className="mb-3 flex items-center gap-2">
        <RunIcon width={18} height={18} className="text-cardio" />
        <h2 className="flex-1 font-semibold">Treadmill · {item.targetMinutes} min</h2>
        {item.done && <span className="text-xs font-semibold text-cardio">DONE</span>}
      </div>
      <Stopwatch compact timerId={item.timerId} targetSec={item.targetMinutes * 60} />
      <div className="mt-3 flex items-center gap-2">
        <NumberInput
          ariaLabel={`Distance in ${unit}`}
          value={item.distance}
          placeholder={`Distance (${unit})`}
          onChange={(v) => patchItem<SessionTreadmill>(index, (it) => ({ ...it, distance: v }))}
          className="text-base"
        />
        <button
          aria-label={item.done ? "Mark not done" : "Mark done"}
          onClick={() => patchItem<SessionTreadmill>(index, (it) => ({ ...it, done: !it.done }))}
          className={`grid h-11 w-12 shrink-0 place-items-center rounded-xl ${
            item.done ? "bg-cardio text-accent-ink" : "bg-surface-2 text-muted"
          }`}
        >
          <CheckIcon width={20} height={20} />
        </button>
      </div>
    </Card>
  );
}

const ADJUST_BTN =
  "grid h-11 w-14 place-items-center rounded-xl border border-text/25 bg-bg text-lg font-bold text-text shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)] transition hover:border-text/50 active:scale-95 active:bg-line";

function RestTimer({
  endsAt,
  totalMs,
  sound,
}: {
  endsAt: number | null;
  totalMs: number | null;
  sound: boolean;
}) {
  const now = useNow(!!endsAt, 200);
  const beeped = useRef<number | null>(null);
  const leftMs = endsAt && now ? endsAt - now : null;
  const left = leftMs === null ? null : Math.ceil(leftMs / 1000);

  useEffect(() => {
    if (endsAt && left !== null && left <= 0 && beeped.current !== endsAt) {
      beeped.current = endsAt;
      if (sound) beep();
      else navigator.vibrate?.([200, 100, 200]);
      updateActive((s) => ({ ...s, restEndsAt: null, restTotalMs: null }));
    }
  }, [endsAt, left, sound]);

  if (!endsAt || left === null || left <= 0) return null;

  const adjust = (deltaSec: number) =>
    updateActive((s) => {
      if (!s.restEndsAt) return s;
      const ends = s.restEndsAt + deltaSec * 1000;
      if (ends <= Date.now()) return { ...s, restEndsAt: null, restTotalMs: null };
      return { ...s, restEndsAt: ends, restTotalMs: Math.max(1000, (s.restTotalMs ?? 0) + deltaSec * 1000) };
    });
  const pct = totalMs && leftMs !== null ? Math.max(0, Math.min(1, leftMs / totalMs)) : 1;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4">
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-accent/30 bg-surface-2 shadow-2xl shadow-black">
        <div className="flex items-center gap-2 p-3">
          <div className="flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Rest</p>
            <p className="font-display tabular text-4xl leading-none font-bold text-accent">{formatDuration(left)}</p>
          </div>
          <button type="button" aria-label="Remove 5 seconds" className={ADJUST_BTN} onClick={() => adjust(-5)}>
            −5
          </button>
          <button type="button" aria-label="Add 5 seconds" className={ADJUST_BTN} onClick={() => adjust(5)}>
            +5
          </button>
          <Button size="md" onClick={() => updateActive((s) => ({ ...s, restEndsAt: null, restTotalMs: null }))}>
            Skip
          </Button>
        </div>
        <div className="h-1 bg-bg">
          <div className="h-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Summary({ session, db, onDone }: { session: Session; db: DB; onDone: () => void }) {
  const dur = ((session.endedAt ?? session.startedAt) - session.startedAt) / 1000;
  const cardio = db.cardio.filter((c) => c.sessionId === session.id);
  return (
    <>
      <PageHeader eyebrow="Workout complete" title="Nice work" />
      <Card>
        <h2 className="font-display text-2xl font-bold uppercase">{session.name}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Time</p>
            <p className="font-display tabular text-3xl font-bold">{formatDuration(dur)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Sets</p>
            <p className="font-display tabular text-3xl font-bold text-accent">{sessionSetCount(session)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Volume</p>
            <p className="font-display tabular text-3xl font-bold">
              {Math.round(sessionVolume(session)).toLocaleString()}
              <span className="ml-1 text-base text-muted">{db.settings.weightUnit}</span>
            </p>
          </div>
        </div>
        {cardio.map((c) => (
          <p key={c.id} className="mt-3 text-sm text-cardio">
            Treadmill: {round(c.distance, 2)} {c.unit} in {formatDuration(c.durationSec)}
          </p>
        ))}
        {!!session.prs?.length && (
          <div className="mt-4 rounded-xl bg-accent/10 p-3">
            <p className="flex items-center gap-2 font-semibold text-accent">
              <TrophyIcon width={18} height={18} /> New personal records
            </p>
            <ul className="mt-1 text-sm">
              {session.prs.map((id) => (
                <li key={id}>{findExercise(id, db.customExercises).name}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Button size="lg" className="mt-4 w-full" onClick={onDone}>
        Done
      </Button>
    </>
  );
}
