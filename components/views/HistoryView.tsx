"use client";

import { useMemo, useState } from "react";
import { findExercise, isBodyweight } from "@/lib/exercises";
import { formatDate, formatDuration, formatTime, round, startOfWeek } from "@/lib/format";
import { update, useDB, useHydrated } from "@/lib/store";
import { useNow } from "@/lib/timers";
import type { Session } from "@/lib/types";
import { bestE1rm, sessionSetCount, sessionVolume } from "@/lib/workout";
import { RunIcon, TrashIcon, TrophyIcon } from "../Icons";
import { Card, PageHeader, Segmented } from "../ui";

const WEEKS = 8;

export function HistoryView() {
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(false);
  const [tab, setTab] = useState<"workouts" | "progress">("workouts");
  const [open, setOpen] = useState<string | null>(null);

  const weeks = useMemo(() => {
    if (!now) return [];
    const thisWeek = startOfWeek(now);
    return Array.from({ length: WEEKS }, (_, i) => {
      const start = thisWeek - (WEEKS - 1 - i) * 7 * 86400000;
      const end = start + 7 * 86400000;
      return {
        start,
        sessions: db.sessions.filter((s) => s.startedAt >= start && s.startedAt < end).length,
        distance: db.cardio
          .filter((c) => c.date >= start && c.date < end && c.unit === db.settings.distanceUnit)
          .reduce((n, c) => n + c.distance, 0),
      };
    });
  }, [db.sessions, db.cardio, db.settings.distanceUnit, now]);

  const sessions = useMemo(() => db.sessions.toReversed(), [db.sessions]);

  const remove = (s: Session) => {
    if (!confirm(`Delete “${s.name}” from ${formatDate(s.startedAt)}?`)) return;
    update((d) => ({
      ...d,
      sessions: d.sessions.filter((x) => x.id !== s.id),
      cardio: d.cardio.filter((c) => c.sessionId !== s.id),
    }));
  };

  return (
    <>
      <PageHeader
        eyebrow="Log"
        title="History"
        action={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "workouts", label: "Workouts" },
              { value: "progress", label: "Progress" },
            ]}
          />
        }
      />

      {!hydrated ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      ) : tab === "workouts" ? (
        <>
          <WeeklyChart weeks={weeks} unit={db.settings.distanceUnit} />
          {sessions.length === 0 ? (
            <Card className="mt-4 text-center text-muted">Finished workouts will show up here.</Card>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {sessions.map((s) => {
                const cardio = db.cardio.filter((c) => c.sessionId === s.id);
                const expanded = open === s.id;
                return (
                  <li key={s.id} className="rounded-2xl border border-line bg-surface">
                    <button className="w-full p-4 text-left" onClick={() => setOpen(expanded ? null : s.id)}>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 truncate font-semibold">{s.name}</p>
                        {!!s.prs?.length && (
                          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                            <TrophyIcon width={12} height={12} /> {s.prs.length} PR
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted">
                        {formatDate(s.startedAt)} {formatTime(s.startedAt)} ·{" "}
                        {formatDuration(((s.endedAt ?? s.startedAt) - s.startedAt) / 1000)} · {sessionSetCount(s)} sets ·{" "}
                        {Math.round(sessionVolume(s)).toLocaleString()} {db.settings.weightUnit}
                      </p>
                    </button>
                    {expanded && (
                      <div className="border-t border-line px-4 pt-3 pb-4">
                        <ul className="flex flex-col gap-2 text-sm">
                          {s.items.map((it, i) =>
                            it.kind === "strength" ? (
                              <li key={i}>
                                <p className="font-medium">
                                  {findExercise(it.exerciseId, db.customExercises).name}
                                  {s.prs?.includes(it.exerciseId) && <span className="ml-1 text-accent">★</span>}
                                </p>
                                <p className="tabular text-muted">
                                  {it.sets.map((x) => (x.weight ? `${x.weight}×${x.reps}` : `${x.reps}`)).join("  ·  ")}
                                </p>
                              </li>
                            ) : null,
                          )}
                          {cardio.map((c) => (
                            <li key={c.id} className="flex items-center gap-2 text-cardio">
                              <RunIcon width={14} height={14} /> {round(c.distance, 2)} {c.unit} · {formatDuration(c.durationSec)}
                            </li>
                          ))}
                        </ul>
                        <button onClick={() => remove(s)} className="mt-4 flex items-center gap-1.5 text-sm text-danger">
                          <TrashIcon width={14} height={14} /> Delete workout
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <Progress />
      )}
    </>
  );
}

function WeeklyChart({
  weeks,
  unit,
}: {
  weeks: { start: number; sessions: number; distance: number }[];
  unit: string;
}) {
  const maxS = Math.max(1, ...weeks.map((w) => w.sessions));
  const maxD = Math.max(0.1, ...weeks.map((w) => w.distance));
  return (
    <Card>
      <div className="flex items-center justify-between text-xs">
        <p className="font-semibold tracking-[0.12em] text-muted uppercase">Last {WEEKS} weeks</p>
        <div className="flex gap-3 text-muted">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-accent" /> workouts</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-cardio" /> {unit}</span>
        </div>
      </div>
      <div className="mt-4 grid h-28 grid-cols-8 items-end gap-2">
        {weeks.map((w) => (
          <div key={w.start} className="flex h-full flex-col justify-end gap-1" title={`${formatDate(w.start)}: ${w.sessions} workouts, ${round(w.distance, 1)} ${unit}`}>
            <div className="flex flex-1 items-end gap-0.5">
              <div className="flex-1 rounded-t bg-accent" style={{ height: `${(w.sessions / maxS) * 100}%`, minHeight: w.sessions ? 4 : 0 }} />
              <div className="flex-1 rounded-t bg-cardio" style={{ height: `${(w.distance / maxD) * 100}%`, minHeight: w.distance ? 4 : 0 }} />
            </div>
            <span className="text-center text-[10px] text-muted">
              {new Date(w.start).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Progress() {
  const db = useDB();
  const unit = db.settings.weightUnit;
  const series = useMemo(() => {
    const map = new Map<string, { date: number; best: number; top: number; reps: number }[]>();
    for (const s of db.sessions)
      for (const it of s.items) {
        if (it.kind !== "strength" || !it.sets.length) continue;
        const top = it.sets.reduce((b, x) => ((x.weight ?? 0) > (b.weight ?? 0) ? x : b), it.sets[0]);
        const arr = map.get(it.exerciseId) ?? [];
        arr.push({ date: s.startedAt, best: bestE1rm(it.sets), top: top.weight ?? 0, reps: Math.max(...it.sets.map((x) => x.reps ?? 0)) });
        map.set(it.exerciseId, arr);
      }
    return [...map.entries()]
      .map(([id, pts]) => ({ ex: findExercise(id, db.customExercises), pts }))
      .sort((a, b) => b.pts.length - a.pts.length);
  }, [db.sessions, db.customExercises]);

  if (!series.length) return <Card className="text-center text-muted">Log a few workouts to see your strength trends.</Card>;

  return (
    <ul className="flex flex-col gap-2">
      {series.map(({ ex, pts }) => {
        const bw = isBodyweight(ex) || pts.every((p) => !p.top);
        const vals = pts.map((p) => (bw ? p.reps : p.best));
        const first = vals[0];
        const latest = vals.at(-1)!;
        const change = first ? ((latest - first) / first) * 100 : 0;
        return (
          <li key={ex.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{ex.name}</p>
              <p className="text-sm text-muted">
                {bw
                  ? `Best ${latest} reps`
                  : `Top set ${pts.at(-1)!.top} ${unit} · est. 1RM ${Math.round(latest)} ${unit}`}{" "}
                · {pts.length}×
              </p>
            </div>
            <Spark values={vals} />
            <span className={`tabular w-12 text-right text-sm font-semibold ${change >= 0 ? "text-accent" : "text-danger"}`}>
              {pts.length > 1 ? `${change >= 0 ? "+" : ""}${Math.round(change)}%` : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 64;
  const h = 24;
  if (values.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
