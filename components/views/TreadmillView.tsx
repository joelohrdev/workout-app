"use client";

import { useMemo, useState } from "react";
import { formatDate, formatDuration, formatPace, round, speed, speedUnit } from "@/lib/format";
import { getDB, update, useDB, useHydrated } from "@/lib/store";
import { clearTimer, elapsedMs, pauseTimer } from "@/lib/timers";
import { logCardio } from "@/lib/workout";
import { Stopwatch } from "../Stopwatch";
import { TrashIcon } from "../Icons";
import { Button, Card, NumberInput, PageHeader, Sheet, Stat } from "../ui";

const TIMER = "treadmill";

export function TreadmillView() {
  const db = useDB();
  const hydrated = useHydrated();
  const unit = db.settings.distanceUnit;
  const t = db.timers[TIMER];
  const hasTime = !!t && (t.running || t.accumulatedMs > 0);

  const [sheet, setSheet] = useState<null | "finish" | "manual">(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [incline, setIncline] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const runs = useMemo(
    () => db.cardio.filter((c) => c.unit === unit).toReversed(),
    [db.cardio, unit],
  );
  const bests = useMemo(() => {
    const longest = runs.reduce((b, r) => (r.distance > (b?.distance ?? 0) ? r : b), runs[0]);
    const qualified = runs.filter((r) => r.distance >= 1 && r.durationSec > 0);
    const fastest = qualified.reduce(
      (b, r) => (!b || r.durationSec / r.distance < b.durationSec / b.distance ? r : b),
      qualified[0],
    );
    const total = runs.reduce((n, r) => n + r.distance, 0);
    return { longest, fastest, total };
  }, [runs]);

  const openFinish = () => {
    pauseTimer(TIMER);
    setSheet("finish");
  };

  const reset = () => {
    setSheet(null);
    setDistance(null);
    setIncline(null);
    setMinutes(null);
    setNotes("");
  };

  const save = () => {
    const durationSec =
      sheet === "finish"
        ? Math.round(elapsedMs(getDB().timers[TIMER], Date.now()) / 1000)
        : Math.round((minutes ?? 0) * 60);
    logCardio({
      date: Date.now(),
      durationSec,
      distance: distance ?? 0,
      unit,
      incline,
      notes: notes.trim() || undefined,
    });
    if (sheet === "finish") clearTimer(TIMER);
    reset();
  };

  const remove = (id: string) => {
    if (!confirm("Delete this run?")) return;
    update((d) => ({ ...d, cardio: d.cardio.filter((c) => c.id !== id) }));
  };

  return (
    <>
      <PageHeader eyebrow="Cardio" title="Treadmill" />

      <Card className="py-8">
        <Stopwatch timerId={TIMER} />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => setSheet("manual")}>
            Log manually
          </Button>
          <Button variant="cardio" disabled={!hasTime} onClick={openFinish}>
            Finish &amp; save
          </Button>
        </div>
        {hasTime && (
          <button
            className="mx-auto mt-3 block text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => confirm("Discard this timer?") && clearTimer(TIMER)}
          >
            Discard timer
          </button>
        )}
      </Card>

      {hydrated && runs.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Card className="p-3">
              <Stat label="All-time" value={round(bests.total, 1)} unit={unit} tone="cardio" />
            </Card>
            <Card className="p-3">
              <Stat label="Longest" value={round(bests.longest?.distance ?? 0, 2)} unit={unit} />
            </Card>
            <Card className="p-3">
              <Stat
                label="Best pace"
                value={bests.fastest ? formatPace(bests.fastest.durationSec, bests.fastest.distance) : "—"}
              />
            </Card>
          </div>

          <h2 className="font-display mt-6 mb-2 text-xl font-bold text-muted uppercase">Recent</h2>
          <ul className="flex flex-col gap-2">
            {runs.slice(0, 30).map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="tabular">{round(r.distance, 2)}</span> {r.unit}
                    <span className="text-muted"> · {formatDuration(r.durationSec)}</span>
                  </p>
                  <p className="truncate text-sm text-muted">
                    {formatDate(r.date)} · {formatPace(r.durationSec, r.distance)}/{r.unit} ·{" "}
                    {round(speed(r.durationSec, r.distance), 1)} {speedUnit(r.unit)}
                    {r.incline ? ` · ${r.incline}% incline` : ""}
                    {r.sessionId ? " · workout" : ""}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <button aria-label="Delete run" onClick={() => remove(r.id)} className="p-2 text-muted">
                  <TrashIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={sheet !== null} onClose={reset} title={sheet === "finish" ? "Save run" : "Log a run"}>
        <div className="flex flex-col gap-4">
          {sheet === "finish" ? (
            <p className="text-muted">
              Time:{" "}
              <span className="tabular font-semibold text-text">
                {formatDuration((t?.accumulatedMs ?? 0) / 1000)}
              </span>
            </p>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted">Duration (minutes)</span>
              <NumberInput ariaLabel="Duration in minutes" value={minutes} onChange={setMinutes} placeholder="30" />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Distance from the treadmill display ({unit})</span>
            <NumberInput ariaLabel={`Distance in ${unit}`} value={distance} onChange={setDistance} placeholder="2.5" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Incline % (optional)</span>
            <NumberInput ariaLabel="Incline percent" value={incline} onChange={setIncline} placeholder="0" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Intervals, felt strong…"
              className="h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-cardio"
            />
          </label>
          <Button
            variant="cardio"
            size="lg"
            disabled={!distance || (sheet === "manual" && !minutes)}
            onClick={save}
          >
            Save run
          </Button>
        </div>
      </Sheet>
    </>
  );
}
