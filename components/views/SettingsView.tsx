"use client";

import { useRef } from "react";
import { bodyCsv, download, runsCsv, setsCsv } from "@/lib/csv";
import { getDB, replaceAll, resetAll, update, useDB } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { DumbbellCard } from "../DumbbellCard";
import { NotificationsCard } from "../NotificationsCard";
import { SyncCard } from "../SyncCard";
import type { DB } from "@/lib/types";
import { Button, Card, PageHeader, Segmented, Stepper } from "../ui";

export function SettingsView() {
  const db = useDB();
  const file = useRef<HTMLInputElement>(null);
  const sync = useSyncStatus();
  const cloud = sync.email ? " This also applies to your other synced devices." : "";
  const set = (patch: Partial<DB["settings"]>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const exportData = () =>
    download(`home-gym-${today()}.json`, JSON.stringify(getDB(), null, 2), "application/json");

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as DB;
      if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error("bad file");
      if (confirm(`Replace all current data with this backup?${cloud}`)) replaceAll(data);
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

        <DumbbellCard />

        <Card className="flex flex-col gap-4">
          <p className="font-semibold">Weekly goals</p>
          <Row label="Workouts per week">
            <div className="w-36">
              <Stepper
                label="Workouts"
                value={db.settings.goals.workoutsPerWeek}
                min={0}
                max={14}
                onChange={(n) => set({ goals: { ...db.settings.goals, workoutsPerWeek: n } })}
              />
            </div>
          </Row>
          <Row label={`Treadmill distance (${db.settings.distanceUnit})`}>
            <div className="w-36">
              <Stepper
                label="Per week"
                value={db.settings.goals.distancePerWeek}
                min={0}
                max={200}
                onChange={(n) => set({ goals: { ...db.settings.goals, distancePerWeek: n } })}
              />
            </div>
          </Row>
          <Row label="Body measurements">
            <Segmented
              value={db.settings.lengthUnit}
              onChange={(v) => set({ lengthUnit: v })}
              options={[{ value: "in", label: "in" }, { value: "cm", label: "cm" }]}
            />
          </Row>
          <p className="text-xs text-muted">Set a goal to 0 to hide it. A week counts toward your streak when you hit your workout goal.</p>
        </Card>

        <SyncCard />

        <NotificationsCard />

        <Card className="flex flex-col gap-3">
          <p className="font-semibold">Your data</p>
          <p className="text-sm text-muted">
            {sync.email
              ? "Saved on this device and synced to your account. Export a JSON backup any time."
              : "Everything is stored on this device only. Export a backup now and then, or to move to a new phone."}
          </p>
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Spreadsheet (CSV)</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" size="sm" onClick={() => download(`home-gym-sets-${today()}.csv`, setsCsv(getDB()))}>Sets</Button>
            <Button variant="ghost" size="sm" onClick={() => download(`home-gym-runs-${today()}.csv`, runsCsv(getDB()))}>Runs</Button>
            <Button variant="ghost" size="sm" onClick={() => download(`home-gym-body-${today()}.csv`, bodyCsv(getDB()))}>Body</Button>
          </div>
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Full backup</p>
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
            onClick={() => confirm(`Erase all workouts, runs and routines? This can't be undone.${cloud}`) && resetAll()}
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

const today = () => new Date().toISOString().slice(0, 10);
