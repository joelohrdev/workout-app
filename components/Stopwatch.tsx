"use client";

import { formatDuration } from "@/lib/format";
import { useDB } from "@/lib/store";
import { elapsedMs, pauseTimer, startTimer, useNow, useWakeLock } from "@/lib/timers";
import { PauseIcon, PlayIcon } from "./Icons";

/** Persistent stopwatch — survives reloads and the phone locking. */
export function Stopwatch({
  timerId,
  targetSec,
  compact = false,
}: {
  timerId: string;
  targetSec?: number;
  compact?: boolean;
}) {
  const db = useDB();
  const t = db.timers[timerId];
  const running = !!t?.running;
  const now = useNow(running);
  useWakeLock(running);
  const ms = now ? elapsedMs(t, now) : (t?.accumulatedMs ?? 0);
  const sec = ms / 1000;
  const pct = targetSec ? Math.min(1, sec / targetSec) : null;

  return (
    <div className={`flex items-center ${compact ? "gap-3" : "flex-col gap-5"}`}>
      <div className={compact ? "flex-1" : "text-center"}>
        <p
          className={`font-display tabular font-bold tracking-tight ${
            compact ? "text-4xl" : "text-[5.5rem] leading-none"
          } ${running ? "text-cardio" : "text-text"}`}
        >
          {formatDuration(sec)}
        </p>
        {pct !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-cardio transition-[width]" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>
      <button
        onClick={() => (running ? pauseTimer(timerId) : startTimer(timerId))}
        aria-label={running ? "Pause" : "Start"}
        className={`grid shrink-0 place-items-center rounded-full font-bold transition active:scale-95 ${
          compact ? "h-14 w-14" : "h-24 w-24"
        } ${running ? "bg-surface-2 text-text" : "bg-cardio text-accent-ink"}`}
      >
        {running ? (
          <PauseIcon width={compact ? 22 : 34} height={compact ? 22 : 34} />
        ) : (
          <PlayIcon width={compact ? 22 : 34} height={compact ? 22 : 34} />
        )}
      </button>
    </div>
  );
}
