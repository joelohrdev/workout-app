"use client";

import { useState } from "react";
import { disablePush, enablePush, pushConfigured, usePushState } from "@/lib/push";
import { update, useDB } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import type { Reminders } from "@/lib/types";
import { Button, Card, Segmented } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function NotificationsCard() {
  const db = useDB();
  const sync = useSyncStatus();
  const push = usePushState();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const r = db.settings.reminders;

  if (!pushConfigured) return null;

  const setR = (patch: Partial<Reminders>) =>
    update((d) => ({
      ...d,
      settings: {
        ...d.settings,
        reminders: { ...d.settings.reminders, ...patch, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    }));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Notifications</p>
      {!sync.email ? (
        <p className="text-sm text-muted">Sign in under Sync across devices first. Notifications are sent from your account.</p>
      ) : push === "needs-install" ? (
        <p className="text-sm text-muted">
          On iPhone, notifications only work in the installed app: tap Share → Add to Home Screen, open it from there,
          and turn them on here.
        </p>
      ) : push === "unsupported" ? (
        <p className="text-sm text-muted">This browser doesn&apos;t support notifications.</p>
      ) : push === "denied" ? (
        <p className="text-sm text-muted">
          Notifications are blocked for this app. Allow them in your phone&apos;s Settings → Notifications, then come back.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {push === "on"
                ? "On for this device. You'll get a “Rest's over” alert if your phone is locked during a rest."
                : "Get a “Rest's over” alert when your phone is locked, and workout-day reminders."}
            </p>
            <Button
              size="sm"
              variant={push === "on" ? "ghost" : "primary"}
              disabled={busy}
              onClick={() => run(push === "on" ? disablePush : enablePush)}
            >
              {push === "on" ? "Turn off" : "Turn on"}
            </Button>
          </div>
          {push === "on" && (
            <div className="flex flex-col gap-3 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3">
                <span>Workout reminders</span>
                <Segmented
                  value={r.enabled ? "on" : "off"}
                  onChange={(v) => setR({ enabled: v === "on" })}
                  options={[
                    { value: "on", label: "On" },
                    { value: "off", label: "Off" },
                  ]}
                />
              </div>
              {r.enabled && (
                <>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((d, i) => {
                      const on = r.days.includes(i);
                      return (
                        <button
                          key={d}
                          aria-pressed={on}
                          onClick={() => setR({ days: on ? r.days.filter((x) => x !== i) : [...r.days, i].sort() })}
                          className={`h-9 rounded-lg text-xs font-semibold ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">Remind me at</span>
                    <input
                      type="time"
                      value={r.time}
                      onChange={(e) => e.target.value && setR({ time: e.target.value })}
                      className="h-10 rounded-xl bg-surface-2 px-3 outline-none"
                    />
                  </label>
                  <p className="text-xs text-muted">Reminders can arrive up to 15 minutes after the time you pick.</p>
                </>
              )}
            </div>
          )}
        </>
      )}
      {msg && <p className="text-sm text-danger">{msg}</p>}
    </Card>
  );
}
