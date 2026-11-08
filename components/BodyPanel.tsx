"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, round } from "@/lib/format";
import { addPhoto, deletePhoto, listPhotos, type Photo } from "@/lib/photos";
import { uid, update, useDB } from "@/lib/store";
import type { BodyLog } from "@/lib/types";
import { PlusIcon, TrashIcon } from "./Icons";
import { LineChart } from "./LineChart";
import { Button, Card, NumberInput, Sheet, Stat } from "./ui";

const FIELDS = [
  { key: "waist", label: "Waist" },
  { key: "chest", label: "Chest" },
  { key: "arms", label: "Arms" },
  { key: "hips", label: "Hips" },
  { key: "thighs", label: "Thighs" },
] as const;

export function BodyPanel() {
  const db = useDB();
  const wUnit = db.settings.weightUnit;
  const lUnit = db.settings.lengthUnit;
  const [adding, setAdding] = useState(false);
  const logs = db.body;
  const weights = logs.filter((l) => l.weight).map((l) => ({ t: l.date, v: l.weight! }));
  const latest = (k: keyof BodyLog) => [...logs].reverse().find((l) => l[k] != null)?.[k] as number | undefined;
  const first = weights[0]?.v;
  const last = weights.at(-1)?.v;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <Stat label="Body weight" value={last ?? "—"} unit={last ? wUnit : undefined} tone="accent" />
          {first !== undefined && last !== undefined && weights.length > 1 && (
            <p className="tabular text-sm text-muted">
              {last - first >= 0 ? "+" : ""}
              {round(last - first, 1)} {wUnit} since {formatDate(weights[0].t, { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
        <div className="mt-3">
          <LineChart points={weights} unit={wUnit} digits={1} />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 text-center">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <p className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">{f.label}</p>
              <p className="tabular font-semibold">{latest(f.key) ?? "—"}</p>
            </div>
          ))}
        </div>
        <Button className="mt-4 w-full" onClick={() => setAdding(true)}>
          <PlusIcon width={16} height={16} /> Log weight &amp; measurements
        </Button>
      </Card>

      <Photos />

      {logs.length > 0 && (
        <>
          <h2 className="font-display text-xl font-bold text-muted uppercase">Entries</h2>
          <ul className="flex flex-col gap-2">
            {logs.toReversed().map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {formatDate(l.date)}
                    {l.weight ? <span className="tabular"> · {l.weight} {wUnit}</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {FIELDS.filter((f) => l[f.key] != null)
                      .map((f) => `${f.label} ${l[f.key]}${lUnit}`)
                      .join(" · ")}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                </div>
                <button
                  aria-label="Delete entry"
                  onClick={() => confirm("Delete this entry?") && update((d) => ({ ...d, body: d.body.filter((x) => x.id !== l.id) }))}
                  className="p-2 text-muted"
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {adding && <BodyForm onClose={() => setAdding(false)} />}
    </div>
  );
}

function BodyForm({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const [log, setLog] = useState<BodyLog>(() => ({ id: uid(), date: Date.now() }));
  const empty = log.weight == null && FIELDS.every((f) => log[f.key] == null);
  return (
    <Sheet open onClose={onClose} title="Log body">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Body weight ({db.settings.weightUnit})</span>
          <NumberInput ariaLabel="Body weight" value={log.weight ?? null} onChange={(v) => setLog({ ...log, weight: v })} placeholder="—" />
        </label>
        <p className="text-sm text-muted">Measurements ({db.settings.lengthUnit}), all optional</p>
        <div className="grid grid-cols-3 gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{f.label}</span>
              <NumberInput
                ariaLabel={f.label}
                value={log[f.key] ?? null}
                onChange={(v) => setLog({ ...log, [f.key]: v })}
                placeholder="—"
                className="text-base"
              />
            </label>
          ))}
        </div>
        <input
          aria-label="Note"
          value={log.note ?? ""}
          onChange={(e) => setLog({ ...log, note: e.target.value })}
          placeholder="Note (morning, after workout…)"
          className="h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent"
        />
        <Button
          size="lg"
          disabled={empty}
          onClick={() => {
            update((d) => ({ ...d, body: [...d.body, log].sort((a, b) => a.date - b.date) }));
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Sheet>
  );
}

function Photos() {
  const [photos, setPhotos] = useState<(Photo & { url: string })[]>([]);
  const [viewing, setViewing] = useState<(Photo & { url: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await listPhotos();
      setPhotos((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
      });
    } catch {
      // IndexedDB unavailable (private mode) — no photos
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read photos from IndexedDB on mount
    void load();
  }, [load]);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Progress photos</p>
          <p className="text-xs text-muted">Saved on this device only, never uploaded</p>
        </div>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => input.current?.click()}>
          <PlusIcon width={16} height={16} /> {busy ? "Saving…" : "Add"}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            await addPhoto(f);
            await load();
          } catch {
            alert("Couldn't save that photo.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setViewing(p)} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img src={p.url} alt={`Progress photo from ${formatDate(p.date)}`} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px]">{formatDate(p.date, { month: "short", day: "numeric", year: "2-digit" })}</span>
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? formatDate(viewing.date) : ""}>
        {viewing && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
            <img src={viewing.url} alt="Progress photo" className="w-full rounded-xl" />
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={async () => {
                if (!confirm("Delete this photo?")) return;
                await deletePhoto(viewing.id);
                setViewing(null);
                await load();
              }}
            >
              Delete photo
            </Button>
          </>
        )}
      </Sheet>
    </Card>
  );
}
