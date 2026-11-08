"use client";

import { useMemo, useState } from "react";
import { activeDays } from "@/lib/goals";
import { startOfDay } from "@/lib/format";
import { useDB } from "@/lib/store";
import { DownIcon, UpIcon } from "./Icons";
import { Card } from "./ui";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/** Month grid showing which days you lifted and/or ran. */
export function Calendar({ now }: { now: number }) {
  const db = useDB();
  const days = useMemo(() => activeDays(db), [db]);
  const [offset, setOffset] = useState(0);
  const base = new Date(now);
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const lead = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = startOfDay(now);
  let lifted = 0;
  let ran = 0;
  for (let d = 1; d <= count; d++) {
    const v = days.get(new Date(month.getFullYear(), month.getMonth(), d).getTime());
    if (v?.lift) lifted++;
    if (v?.run) ran++;
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <button aria-label="Previous month" onClick={() => setOffset(offset - 1)} className="-rotate-90 p-1 text-muted">
          <UpIcon width={18} height={18} />
        </button>
        <p className="font-semibold">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          aria-label="Next month"
          disabled={offset >= 0}
          onClick={() => setOffset(offset + 1)}
          className="-rotate-90 p-1 text-muted disabled:opacity-30"
        >
          <DownIcon width={18} height={18} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const ts = new Date(month.getFullYear(), month.getMonth(), i + 1).getTime();
          const v = days.get(ts);
          return (
            <span
              key={i}
              className={`tabular relative grid aspect-square place-items-center rounded-lg text-xs font-semibold ${
                v?.lift ? "bg-accent text-accent-ink" : v?.run ? "bg-cardio/80 text-accent-ink" : "bg-surface-2 text-muted"
              } ${ts === today ? "ring-2 ring-text" : ""}`}
            >
              {i + 1}
              {v?.lift && v.run && <i className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-cardio" />}
            </span>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-accent" /> {lifted} lifting days</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-cardio" /> {ran} treadmill days</span>
      </p>
    </Card>
  );
}
