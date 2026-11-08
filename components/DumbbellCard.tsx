"use client";

import { useState } from "react";
import { availableWeights, describeDumbbells } from "@/lib/dumbbells";
import { update, useDB } from "@/lib/store";
import type { Dumbbells } from "@/lib/types";
import { Card, Segmented, Stepper } from "./ui";

/** Which dumbbells you own, so suggestions only use weights you have. */
export function DumbbellCard() {
  const db = useDB();
  const d = db.settings.dumbbells;
  const unit = db.settings.weightUnit;
  // what the user is typing; falls back to the saved list (state starts empty during hydration)
  const [text, setText] = useState("");
  const set = (next: Dumbbells) => update((x) => ({ ...x, settings: { ...x.settings, dumbbells: next } }));

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Your dumbbells</p>
        <Segmented
          value={d.mode}
          onChange={(mode) => {
            if (mode === "adjustable") return set({ mode, min: 5, max: 50, step: unit === "lb" ? 5 : 2 });
            const weights = [5, 10, 15, 20, 25, 30];
            setText(weights.join(", "));
            set({ mode, weights });
          }}
          options={[
            { value: "adjustable", label: "Adjustable" },
            { value: "fixed", label: "Fixed pairs" },
          ]}
        />
      </div>
      {d.mode === "adjustable" ? (
        <div className="grid grid-cols-3 gap-2">
          <Stepper label="Lightest" value={d.min} min={0} max={d.max} step={d.step || 1} onChange={(n) => set({ ...d, min: n })} />
          <Stepper label="Heaviest" value={d.max} min={d.min} max={300} step={d.step || 1} onChange={(n) => set({ ...d, max: n })} />
          <Stepper label="Step" value={d.step} min={0.5} max={25} step={d.step >= 5 ? 2.5 : 0.5} onChange={(n) => set({ ...d, step: n })} />
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Weights you own ({unit} per dumbbell), separated by commas</span>
          <input
            value={text || (d.mode === "fixed" ? d.weights.join(", ") : "")}
            inputMode="decimal"
            onChange={(e) => {
              setText(e.target.value);
              set({ mode: "fixed", weights: parse(e.target.value) });
            }}
            placeholder="5, 10, 15, 20, 25, 30"
            className="h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      )}
      <p className="text-xs text-muted">
        {availableWeights(d).length} weights: {describeDumbbells(d, unit)}. Weight suggestions only use these.
      </p>
    </Card>
  );
}

function parse(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}
