"use client";

import { useEffect, useState } from "react";
import { update } from "./store";
import type { TimerState } from "./types";

export const IDLE: TimerState = { running: false, startedAt: null, accumulatedMs: 0 };

export function elapsedMs(t: TimerState | undefined, now: number): number {
  if (!t) return 0;
  return t.accumulatedMs + (t.running && t.startedAt ? now - t.startedAt : 0);
}

function setTimer(id: string, fn: (t: TimerState) => TimerState | null) {
  update((db) => {
    const next = fn(db.timers[id] ?? IDLE);
    const timers = { ...db.timers };
    if (next) timers[id] = next;
    else delete timers[id];
    return { ...db, timers };
  });
}

export function startTimer(id: string) {
  setTimer(id, (t) => (t.running ? t : { ...t, running: true, startedAt: Date.now() }));
}

export function pauseTimer(id: string) {
  setTimer(id, (t) =>
    t.running
      ? { running: false, startedAt: null, accumulatedMs: elapsedMs(t, Date.now()) }
      : t,
  );
}

export function clearTimer(id: string) {
  setTimer(id, () => null);
}

/** Re-renders on an interval while `active`, returning the current epoch ms (null before mount). */
export function useNow(active = true, intervalMs = 250): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial clock read after mount
    setNow(Date.now());
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/** Keep the screen on while a timer is running (supported browsers only). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

let audioCtx: AudioContext | null = null;
export function beep(times = 3) {
  try {
    navigator.vibrate?.([200, 100, 200]);
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i === times - 1 ? 1320 : 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.2);
    }
  } catch {
    // audio not available
  }
}
