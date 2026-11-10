"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { findExercise } from "@/lib/exercises";
import { formatDate, formatDuration, round, startOfDay, startOfWeek } from "@/lib/format";
import { useDB, useHydrated } from "@/lib/store";
import { weekStreak } from "@/lib/goals";
import { useNow } from "@/lib/timers";
import { nextRoutine, sessionSetCount, sessionVolume, startSession } from "@/lib/workout";
import { ChevronRight, DumbbellIcon, GearIcon, PlayIcon, RunIcon } from "../Icons";
import { Button, Card, PageHeader, Stat } from "../ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function TodayView() {
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(false);
  const router = useRouter();

  const week = useMemo(() => {
    if (!now) return null;
    const start = startOfWeek(now);
    const sessions = db.sessions.filter((s) => s.startedAt >= start);
    const cardio = db.cardio.filter((c) => c.date >= start);
    const days = new Set<number>();
    for (const s of sessions) days.add(Math.round((startOfDay(s.startedAt) - start) / 86400000));
    for (const c of cardio) days.add(Math.round((startOfDay(c.date) - start) / 86400000));
    return {
      sessions: sessions.length,
      distance: cardio.reduce((n, c) => n + c.distance, 0),
      cardioSec: cardio.reduce((n, c) => n + c.durationSec, 0),
      volume: sessions.reduce((n, s) => n + sessionVolume(s), 0),
      days,
      today: Math.round((startOfDay(now) - start) / 86400000),
    };
  }, [db.sessions, db.cardio, now]);

  const up = nextRoutine(db);
  const goals = db.settings.goals;
  const streak = useMemo(() => (now ? weekStreak(db, now) : 0), [db, now]);
  const last = db.sessions.at(-1);
  const { weightUnit, distanceUnit } = db.settings;

  const begin = (routine: typeof up) => {
    if (!db.activeSession) startSession(routine);
    router.push("/workout");
  };

  return (
    <>
      <PageHeader
        eyebrow={now ? formatDate(now, { weekday: "long", month: "long", day: "numeric" }) : " "}
        title="Home Gym"
        action={
          <Link href="/settings" aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-full bg-surface text-muted">
            <GearIcon />
          </Link>
        }
      />

      {!hydrated ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <div className="flex flex-col gap-4">
          {db.activeSession ? (
            <Card className="border-accent/40 bg-accent/10">
              <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">In progress</p>
              <h2 className="font-display mt-1 text-2xl font-bold uppercase">{db.activeSession.name}</h2>
              <Button size="lg" className="mt-4 w-full" onClick={() => router.push("/workout")}>
                Resume workout
              </Button>
            </Card>
          ) : up ? (
            <Card>
              <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Up next</p>
              <h2 className="font-display mt-1 text-2xl leading-tight font-bold uppercase">{up.name}</h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
                {up.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {it.kind === "treadmill" ? (
                      <>
                        <RunIcon width={16} height={16} className="text-cardio" />
                        Treadmill · {it.minutes} min
                      </>
                    ) : (
                      <>
                        <DumbbellIcon width={16} height={16} className="text-accent" />
                        {findExercise(it.exerciseId, db.customExercises).name}
                        <span className="ml-auto tabular">
                          {it.sets}×{it.reps}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-4 w-full" onClick={() => begin(up)}>
                <PlayIcon width={18} height={18} /> Start workout
              </Button>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Link href="/treadmill" className="rounded-2xl border border-line bg-surface p-4">
              <RunIcon className="text-cardio" />
              <p className="mt-3 font-semibold">Treadmill</p>
              <p className="text-sm text-muted">Time a run or walk</p>
            </Link>
            <button onClick={() => begin(null)} className="rounded-2xl border border-line bg-surface p-4 text-left">
              <DumbbellIcon className="text-accent" />
              <p className="mt-3 font-semibold">Free workout</p>
              <p className="text-sm text-muted">Pick exercises as you go</p>
            </button>
          </div>

          {week && (
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">This week</p>
                <div className="flex gap-1.5">
                  {DAYS.map((d, i) => (
                    <span
                      key={i}
                      className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${
                        week.days.has(i)
                          ? "bg-accent text-accent-ink"
                          : i === week.today
                            ? "border border-accent/60 text-text"
                            : "bg-surface-2 text-muted"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat
                  label="Workouts"
                  value={week.sessions}
                  unit={goals.workoutsPerWeek ? `/ ${goals.workoutsPerWeek}` : undefined}
                  tone="accent"
                />
                <Stat
                  label="Distance"
                  value={round(week.distance, 1)}
                  unit={goals.distancePerWeek ? `/ ${goals.distancePerWeek} ${distanceUnit}` : distanceUnit}
                  tone="cardio"
                />
                <Stat label="Run time" value={formatDuration(week.cardioSec)} />
              </div>
              {(goals.workoutsPerWeek > 0 || goals.distancePerWeek > 0) && (
                <div className="mt-3 flex flex-col gap-1.5">
                  {goals.workoutsPerWeek > 0 && (
                    <GoalBar pct={week.sessions / goals.workoutsPerWeek} color="bg-accent" label="Workout goal" />
                  )}
                  {goals.distancePerWeek > 0 && (
                    <GoalBar pct={week.distance / goals.distancePerWeek} color="bg-cardio" label="Distance goal" />
                  )}
                </div>
              )}
              {streak > 0 && (
                <p className="mt-3 text-sm font-semibold text-accent">
                  🔥 {streak} week{streak === 1 ? "" : "s"} in a row hitting your workout goal
                </p>
              )}
              {week.volume > 0 && (
                <p className="mt-3 text-sm text-muted">
                  {Math.round(week.volume).toLocaleString()} {weightUnit} lifted this week
                </p>
              )}
            </Card>
          )}

          {last && (
            <Link href="/history" className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Last workout</p>
                <p className="mt-1 truncate font-semibold">{last.name}</p>
                <p className="text-sm text-muted">
                  {formatDate(last.startedAt)} · {sessionSetCount(last)} sets
                  {last.prs?.length ? ` · ${last.prs.length} PR` : ""}
                </p>
              </div>
              <ChevronRight className="shrink-0 text-muted" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function GoalBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(p * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full ${color}`} style={{ width: `${p * 100}%` }} />
    </div>
  );
}
