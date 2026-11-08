"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, round, speedUnit } from "@/lib/format";
import { fromRecipe } from "@/lib/seed";
import { getDB, uid, update, useDB } from "@/lib/store";
import {
  addToTimer,
  beep,
  clearTimer,
  elapsedMs,
  pauseTimer,
  startTimer,
  useNow,
  useWakeLock,
} from "@/lib/timers";
import type { IntervalPlan, IntervalRecipe } from "@/lib/types";
import { logCardio } from "@/lib/workout";
import { PauseIcon, PlayIcon, PlusIcon } from "./Icons";
import { Button, Card, NumberInput, Sheet, Stepper } from "./ui";

const TIMER = "interval";

function planTotal(p: IntervalPlan) {
  return p.blocks.reduce((n, b) => n + b.sec, 0);
}

export function IntervalPanel() {
  const db = useDB();
  const run = db.intervalRun;
  const plan = run ? db.intervalPlans.find((p) => p.id === run.planId) : null;
  const [editing, setEditing] = useState<IntervalPlan | null>(null);

  if (run && plan) return <IntervalRunner plan={plan} />;

  const start = (p: IntervalPlan) => {
    clearTimer(TIMER);
    update((d) => ({ ...d, intervalRun: { planId: p.id, timerId: TIMER } }));
    startTimer(TIMER);
  };

  return (
    <>
      <ul className="flex flex-col gap-3">
        {db.intervalPlans.map((p) => {
          const work = p.blocks.filter((b) => b.label.startsWith("Work"));
          return (
            <li key={p.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl leading-tight font-bold uppercase">{p.name}</h2>
                    <p className="text-sm text-muted">
                      {formatDuration(planTotal(p))} total · {work.length} work blocks
                    </p>
                  </div>
                </div>
                <IntervalStrip plan={p} />
                <div className="mt-4 flex gap-2">
                  <Button variant="cardio" className="flex-1" onClick={() => start(p)}>
                    <PlayIcon width={16} height={16} /> Start
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(structuredClone(p))}>
                    Edit
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Button
        variant="ghost"
        className="mt-3 w-full"
        onClick={() =>
          setEditing({
            id: uid(),
            name: "",
            createdAt: Date.now(),
            ...fromRecipe({
              warmSec: 300,
              rounds: 6,
              work: { sec: 60, speed: null, incline: null },
              recover: { sec: 90, speed: null, incline: null },
              coolSec: 300,
              easySpeed: null,
            }),
          })
        }
      >
        <PlusIcon width={18} height={18} /> New interval plan
      </Button>
      {editing && <PlanEditor initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Proportional bar showing the plan's blocks; work blocks are bright. */
function IntervalStrip({ plan, at }: { plan: IntervalPlan; at?: number }) {
  const total = planTotal(plan) || 1;
  return (
    <div className="relative mt-3 flex h-3 gap-px overflow-hidden rounded-full">
      {plan.blocks.map((b, i) => (
        <div
          key={i}
          className={b.label.startsWith("Work") ? "bg-cardio" : "bg-cardio/25"}
          style={{ width: `${(b.sec / total) * 100}%` }}
        />
      ))}
      {at !== undefined && (
        <div className="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${Math.min(1, at / total) * 100}%` }} />
      )}
    </div>
  );
}

function IntervalRunner({ plan }: { plan: IntervalPlan }) {
  const db = useDB();
  const unit = db.settings.distanceUnit;
  const t = db.timers[TIMER];
  const running = !!t?.running;
  const now = useNow(running, 200);
  useWakeLock(running);
  const [saving, setSaving] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const total = planTotal(plan);
  const elapsed = (now ? elapsedMs(t, now) : (t?.accumulatedMs ?? 0)) / 1000;
  const ends = useMemo(
    () => plan.blocks.map((_, i) => plan.blocks.slice(0, i + 1).reduce((n, x) => n + x.sec, 0)),
    [plan.blocks],
  );
  const idx = ends.findIndex((e) => e > elapsed);
  const finished = idx === -1;
  const block = finished ? null : plan.blocks[idx];
  const next = finished ? null : plan.blocks[idx + 1];
  const blockLeft = finished ? 0 : ends[idx] - elapsed;

  // cue each block change, and stop at the end
  const lastIdx = useRef<number | null>(null);
  useEffect(() => {
    if (lastIdx.current !== null && lastIdx.current !== idx && running) {
      if (finished) {
        pauseTimer(TIMER);
        beep(3);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- open the save sheet when the plan ends
        setSaving(true);
      } else beep(2);
    }
    lastIdx.current = idx;
  }, [idx, finished, running]);

  const save = () => {
    const sec = Math.round(Math.min(total, elapsedMs(getDB().timers[TIMER], Date.now()) / 1000));
    logCardio({ date: Date.now(), durationSec: sec, distance: distance ?? 0, unit, planName: plan.name });
    clearTimer(TIMER);
    update((d) => ({ ...d, intervalRun: null }));
  };
  const discard = () => {
    if (!confirm("Stop this interval run without saving?")) return;
    clearTimer(TIMER);
    update((d) => ({ ...d, intervalRun: null }));
  };

  const isWork = !!block?.label.startsWith("Work");
  return (
    <>
      <Card className={`py-6 ${isWork ? "border-cardio/60 bg-cardio/10" : ""}`}>
        <p className="text-center text-xs font-semibold tracking-[0.14em] text-muted uppercase">{plan.name}</p>
        <p className={`font-display mt-1 text-center text-3xl font-bold uppercase ${isWork ? "text-cardio" : ""}`}>
          {block?.label ?? "Done!"}
        </p>
        <p className="font-display tabular text-center text-[6rem] leading-none font-bold">
          {formatDuration(Math.ceil(blockLeft))}
        </p>
        {block && (block.speed || block.incline) ? (
          <div className="mt-3 flex justify-center gap-8">
            {block.speed ? (
              <div className="text-center">
                <p className="font-display tabular text-4xl font-bold">{block.speed}</p>
                <p className="text-xs text-muted uppercase">{speedUnit(unit)}</p>
              </div>
            ) : null}
            {block.incline !== null && block.incline !== undefined ? (
              <div className="text-center">
                <p className="font-display tabular text-4xl font-bold">{block.incline}%</p>
                <p className="text-xs text-muted uppercase">incline</p>
              </div>
            ) : null}
          </div>
        ) : null}
        {next && (
          <p className="mt-4 text-center text-sm text-muted">
            Next: {next.label} · {formatDuration(next.sec)}
            {next.speed ? ` · ${next.speed} ${speedUnit(unit)}` : ""}
            {next.incline ? ` · ${next.incline}%` : ""}
          </p>
        )}
        <IntervalStrip plan={plan} at={elapsed} />
        <p className="tabular mt-2 text-center text-sm text-muted">
          {formatDuration(elapsed)} / {formatDuration(total)}
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="ghost" onClick={discard}>
            Stop
          </Button>
          <button
            onClick={() => (running ? pauseTimer(TIMER) : !finished && startTimer(TIMER))}
            aria-label={running ? "Pause" : "Resume"}
            disabled={finished}
            className={`grid h-20 w-20 place-items-center rounded-full transition active:scale-95 disabled:opacity-40 ${
              running ? "bg-surface-2 text-text" : "bg-cardio text-accent-ink"
            }`}
          >
            {running ? <PauseIcon width={30} height={30} /> : <PlayIcon width={30} height={30} />}
          </button>
          <Button variant="ghost" disabled={finished} onClick={() => addToTimer(TIMER, blockLeft * 1000)}>
            Skip
          </Button>
        </div>
        <Button
          variant="cardio"
          className="mt-4 w-full"
          onClick={() => {
            pauseTimer(TIMER);
            setSaving(true);
          }}
        >
          Finish &amp; save
        </Button>
      </Card>

      <Sheet open={saving} onClose={() => setSaving(false)} title="Save run">
        <div className="flex flex-col gap-4">
          <p className="text-muted">
            {plan.name} · <span className="tabular text-text">{formatDuration(Math.min(total, elapsed))}</span>
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Distance from the treadmill display ({unit})</span>
            <NumberInput ariaLabel={`Distance in ${unit}`} value={distance} onChange={setDistance} placeholder="2.0" />
          </label>
          <Button variant="cardio" size="lg" disabled={!distance} onClick={save}>
            Save run
          </Button>
          {distance ? (
            <p className="text-center text-sm text-muted">
              Avg {round(distance / (Math.min(total, elapsed) / 3600 || 1), 1)} {speedUnit(unit)}
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

function PlanEditor({ initial, onClose }: { initial: IntervalPlan; onClose: () => void }) {
  const db = useDB();
  const sp = speedUnit(db.settings.distanceUnit);
  const exists = db.intervalPlans.some((p) => p.id === initial.id);
  const [name, setName] = useState(initial.name);
  const [r, setR] = useState<IntervalRecipe>(
    initial.recipe ?? {
      warmSec: 300,
      rounds: 6,
      work: { sec: 60, speed: null, incline: null },
      recover: { sec: 90, speed: null, incline: null },
      coolSec: 300,
      easySpeed: null,
    },
  );
  const plan = { ...initial, name, ...fromRecipe(r) };

  const save = () => {
    update((d) => ({
      ...d,
      intervalPlans: exists
        ? d.intervalPlans.map((p) => (p.id === plan.id ? plan : p))
        : [...d.intervalPlans, plan],
    }));
    onClose();
  };
  const remove = () => {
    if (!confirm(`Delete “${initial.name}”?`)) return;
    update((d) => ({ ...d, intervalPlans: d.intervalPlans.filter((p) => p.id !== initial.id) }));
    onClose();
  };

  const Part = ({ title, k }: { title: string; k: "work" | "recover" }) => (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-2 font-semibold">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        <Stepper
          label="Seconds"
          value={r[k].sec}
          min={k === "recover" ? 0 : 10}
          max={1200}
          step={10}
          onChange={(n) => setR({ ...r, [k]: { ...r[k], sec: n } })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{sp}</span>
          <NumberInput
            ariaLabel={`${title} speed`}
            value={r[k].speed}
            placeholder="—"
            onChange={(v) => setR({ ...r, [k]: { ...r[k], speed: v } })}
            className="h-10 text-base"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Incline %</span>
          <NumberInput
            ariaLabel={`${title} incline`}
            value={r[k].incline}
            placeholder="—"
            onChange={(v) => setR({ ...r, [k]: { ...r[k], incline: v } })}
            className="h-10 text-base"
          />
        </label>
      </div>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={exists ? "Edit plan" : "New plan"}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Plan name, e.g. Sprint 30/30"
        className="h-12 w-full rounded-xl bg-surface-2 px-4 text-lg font-semibold outline-none focus:ring-2 focus:ring-cardio"
      />
      <div className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Stepper label="Warm-up" suffix="m" value={r.warmSec / 60} min={0} max={30} onChange={(n) => setR({ ...r, warmSec: n * 60 })} />
          <Stepper label="Rounds" value={r.rounds} min={1} max={40} onChange={(n) => setR({ ...r, rounds: n })} />
          <Stepper label="Cool-down" suffix="m" value={r.coolSec / 60} min={0} max={30} onChange={(n) => setR({ ...r, coolSec: n * 60 })} />
        </div>
        {Part({ title: "Work", k: "work" })}
        {Part({ title: "Recover", k: "recover" })}
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Warm-up / cool-down speed ({sp})</span>
          <NumberInput
            ariaLabel="Easy speed"
            value={r.easySpeed}
            placeholder="—"
            onChange={(v) => setR({ ...r, easySpeed: v })}
            className="h-10 w-24 text-base"
          />
        </label>
        <div>
          <IntervalStrip plan={plan} />
          <p className="mt-1 text-sm text-muted">Total {formatDuration(planTotal(plan))}</p>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        {exists && (
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        )}
        <Button variant="cardio" className="flex-1" disabled={!name.trim()} onClick={save}>
          Save plan
        </Button>
      </div>
    </Sheet>
  );
}
