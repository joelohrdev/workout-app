"use client";

import { useRef } from "react";
import { getDB, replaceAll, resetAll, update, useDB } from "@/lib/store";
import type { DB } from "@/lib/types";
import { Button, Card, PageHeader, Segmented, Stepper } from "../ui";

export function SettingsView() {
  const db = useDB();
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<DB["settings"]>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getDB(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `home-gym-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as DB;
      if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error("bad file");
      if (confirm("Replace all current data with this backup?")) replaceAll(data);
    } catch {
      alert("That file doesn't look like a Home Gym backup.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="App" title="Settings" />
      <div className="flex flex-col gap-3">
        <Card className="flex flex-col gap-4">
          <Row label="Weight unit">
            <Segmented value={db.settings.weightUnit} onChange={(v) => set({ weightUnit: v })} options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]} />
          </Row>
          <Row label="Treadmill distance">
            <Segmented value={db.settings.distanceUnit} onChange={(v) => set({ distanceUnit: v })} options={[{ value: "mi", label: "mi" }, { value: "km", label: "km" }]} />
          </Row>
          <Row label="Rest after each set">
            <div className="w-36">
              <Stepper
                label="Seconds"
                value={db.settings.restSec}
                min={0}
                max={300}
                step={5}
                suffix="s"
                onChange={(n) => set({ restSec: n })}
              />
            </div>
          </Row>
          <Row label="Rest timer beep">
            <Segmented
              value={db.settings.restSound ? "on" : "off"}
              onChange={(v) => set({ restSound: v === "on" })}
              options={[{ value: "on", label: "On" }, { value: "off", label: "Vibrate" }]}
            />
          </Row>
          <p className="text-xs text-muted">The rest timer starts automatically when you check off a set. Set it to 0 to turn it off. Changing units relabels numbers; it doesn’t convert past entries.</p>
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="font-semibold">Your data</p>
          <p className="text-sm text-muted">
            Everything is stored on this device only. Export a backup now and then, or to move to a new phone.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={exportData}>Export JSON</Button>
            <Button variant="ghost" onClick={() => file.current?.click()}>Import JSON</Button>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="danger"
            onClick={() => confirm("Erase all workouts, runs and routines? This can't be undone.") && resetAll()}
          >
            Erase everything
          </Button>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      {children}
    </div>
  );
}
