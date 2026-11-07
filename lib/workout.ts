"use client";

import { uid, update } from "./store";
import { clearTimer, elapsedMs } from "./timers";
import type {
  CardioLog,
  DB,
  LoggedSet,
  Routine,
  Session,
  SessionStrength,
  WeightUnit,
} from "./types";

/** Epley estimated one-rep max */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

export function bestE1rm(sets: LoggedSet[]): number {
  return sets.reduce(
    (best, s) => (s.done ? Math.max(best, e1rm(s.weight ?? 0, s.reps ?? 0)) : best),
    0,
  );
}

/** Most recent finished session entry for an exercise */
export function lastPerformance(
  db: DB,
  exerciseId: string,
  excludeSessionId?: string,
): SessionStrength | null {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const s = db.sessions[i];
    if (s.id === excludeSessionId) continue;
    const item = s.items.find(
      (it): it is SessionStrength =>
        it.kind === "strength" &&
        it.exerciseId === exerciseId &&
        it.sets.some((x) => x.done),
    );
    if (item) return item;
  }
  return null;
}

/**
 * Simple double-progression rule: if every set last time hit its target reps,
 * suggest adding the smallest dumbbell jump. Otherwise repeat the weight.
 */
export function suggestWeight(
  last: SessionStrength | null,
  unit: WeightUnit,
): { weight: number | null; bump: boolean } {
  if (!last) return { weight: null, bump: false };
  const done = last.sets.filter((s) => s.done);
  const top = Math.max(0, ...done.map((s) => s.weight ?? 0));
  if (!top) return { weight: null, bump: false };
  const allHit = done.length >= last.sets.length && done.every((s) => (s.reps ?? 0) >= s.targetReps);
  const step = unit === "lb" ? 5 : 2;
  return allHit ? { weight: top + step, bump: true } : { weight: top, bump: false };
}

export function buildSession(db: DB, routine: Routine | null): Session {
  const id = uid();
  return {
    id,
    routineId: routine?.id ?? null,
    name: routine?.name ?? "Quick workout",
    startedAt: Date.now(),
    endedAt: null,
    restEndsAt: null,
    items: (routine?.items ?? []).map((item, i) => {
      if (item.kind === "treadmill") {
        return {
          kind: "treadmill",
          targetMinutes: item.minutes,
          timerId: `session-${id}-${i}`,
          distance: null,
          done: false,
        };
      }
      const last = lastPerformance(db, item.exerciseId);
      const { weight } = suggestWeight(last, db.settings.weightUnit);
      return {
        kind: "strength",
        exerciseId: item.exerciseId,
        restSec: item.restSec,
        sets: Array.from({ length: item.sets }, () => ({
          reps: item.reps,
          weight,
          targetReps: item.reps,
          done: false,
        })),
      };
    }),
  };
}

export function startSession(routine: Routine | null) {
  update((db) => ({ ...db, activeSession: buildSession(db, routine) }));
}

export function updateActive(fn: (s: Session) => Session) {
  update((db) => (db.activeSession ? { ...db, activeSession: fn(db.activeSession) } : db));
}

export function discardActive() {
  update((db) => {
    const timers = { ...db.timers };
    db.activeSession?.items.forEach((it) => {
      if (it.kind === "treadmill") delete timers[it.timerId];
    });
    return { ...db, activeSession: null, timers };
  });
}

/** Finish the active session: save it, log treadmill blocks as cardio, flag PRs. */
export function finishActive(): Session | null {
  let saved: Session | null = null;
  update((db) => {
    const s = db.activeSession;
    if (!s) return db;
    const now = Date.now();
    const cardio: CardioLog[] = [];
    const timers = { ...db.timers };
    const items = s.items
      .map((it) => {
        if (it.kind !== "treadmill") return { ...it, sets: it.sets.filter((x) => x.done) };
        const sec = Math.round(elapsedMs(db.timers[it.timerId], now) / 1000);
        delete timers[it.timerId];
        if (sec > 0 || it.distance) {
          cardio.push({
            id: uid(),
            date: now,
            durationSec: sec,
            distance: it.distance ?? 0,
            unit: db.settings.distanceUnit,
            sessionId: s.id,
          });
        }
        return it;
      })
      .filter((it) => it.kind === "treadmill" || it.sets.length > 0);

    const prs: string[] = [];
    for (const it of items) {
      if (it.kind !== "strength") continue;
      const best = bestE1rm(it.sets);
      let prev = 0;
      for (const old of db.sessions)
        for (const o of old.items)
          if (o.kind === "strength" && o.exerciseId === it.exerciseId)
            prev = Math.max(prev, bestE1rm(o.sets));
      if (best > 0 && prev > 0 && best > prev) prs.push(it.exerciseId);
    }

    saved = { ...s, items, endedAt: now, restEndsAt: null, prs };
    return {
      ...db,
      activeSession: null,
      timers,
      sessions: [...db.sessions, saved],
      cardio: [...db.cardio, ...cardio],
    };
  });
  return saved;
}

export function sessionVolume(s: Session): number {
  let v = 0;
  for (const it of s.items)
    if (it.kind === "strength")
      for (const set of it.sets) if (set.done) v += (set.weight ?? 0) * (set.reps ?? 0);
  return v;
}

export function sessionSetCount(s: Session): number {
  return s.items.reduce(
    (n, it) => n + (it.kind === "strength" ? it.sets.filter((x) => x.done).length : 0),
    0,
  );
}

/** Routine that was done least recently (never-done routines first). */
export function nextRoutine(db: DB): Routine | null {
  if (!db.routines.length) return null;
  const lastDone = new Map<string, number>();
  for (const s of db.sessions) if (s.routineId) lastDone.set(s.routineId, s.startedAt);
  return [...db.routines].sort(
    (a, b) => (lastDone.get(a.id) ?? 0) - (lastDone.get(b.id) ?? 0),
  )[0];
}

export function logCardio(log: Omit<CardioLog, "id">) {
  update((db) => ({ ...db, cardio: [...db.cardio, { ...log, id: uid() }] }));
}

export { clearTimer };
