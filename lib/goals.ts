import { startOfDay, startOfWeek } from "./format";
import type { DB } from "./types";

const WEEK = 7 * 86400000;

/** Workouts and treadmill distance for the week starting at `weekStart`. */
export function weekTotals(db: DB, weekStart: number) {
  const end = weekStart + WEEK;
  return {
    workouts: db.sessions.filter((s) => s.startedAt >= weekStart && s.startedAt < end).length,
    distance: db.cardio
      .filter((c) => c.date >= weekStart && c.date < end && c.unit === db.settings.distanceUnit)
      .reduce((n, c) => n + c.distance, 0),
  };
}

/**
 * Consecutive weeks (ending this week, or last week if this one isn't done
 * yet) where you hit your workouts-per-week goal.
 */
export function weekStreak(db: DB, now: number): number {
  const goal = db.settings.goals.workoutsPerWeek;
  if (!goal) return 0;
  let week = startOfWeek(now);
  let streak = 0;
  if (weekTotals(db, week).workouts >= goal) streak++;
  week -= WEEK;
  const first = Math.min(...db.sessions.map((s) => s.startedAt), now);
  while (week >= startOfWeek(first) && weekTotals(db, week).workouts >= goal) {
    streak++;
    week -= WEEK;
  }
  return streak;
}

/** Day-start timestamps that had a workout or a treadmill run. */
export function activeDays(db: DB): Map<number, { lift: boolean; run: boolean }> {
  const days = new Map<number, { lift: boolean; run: boolean }>();
  for (const s of db.sessions) {
    const d = startOfDay(s.startedAt);
    days.set(d, { ...(days.get(d) ?? { lift: false, run: false }), lift: true });
  }
  for (const c of db.cardio) {
    const d = startOfDay(c.date);
    days.set(d, { ...(days.get(d) ?? { lift: false, run: false }), run: true });
  }
  return days;
}
