"use client";

import { useState } from "react";
import { formatTime } from "@/lib/format";
import { sendCode, signOut, syncNow, useSyncStatus, verifyCode } from "@/lib/sync";
import { Button, Card } from "./ui";

export function SyncCard() {
  const s = useSyncStatus();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!s.configured) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Something went wrong";
      setMsg(/fetch|network/i.test(text) ? "Couldn't reach the server. Check your connection and try again." : text);
    } finally {
      setBusy(false);
    }
  };

  if (s.email) {
    const label =
      s.phase === "syncing"
        ? "Syncing…"
        : s.phase === "offline"
          ? "Offline — will sync when you're back online"
          : s.phase === "error"
            ? `Sync failed: ${s.error}`
            : s.lastSyncedAt
              ? `Synced at ${formatTime(s.lastSyncedAt)}`
              : "Waiting to sync";
    return (
      <Card className="flex flex-col gap-3">
        <p className="font-semibold">Sync across devices</p>
        <p className="text-sm text-muted">
          Signed in as <span className="text-text">{s.email}</span>
        </p>
        <p className={`flex items-center gap-2 text-sm ${s.phase === "error" ? "text-danger" : "text-muted"}`}>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              s.phase === "error" ? "bg-danger" : s.phase === "idle" && s.lastSyncedAt ? "bg-accent" : "bg-muted"
            }`}
          />
          {label}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={s.phase === "syncing"} onClick={() => void syncNow()}>
            Sync now
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              confirm("Sign out? Your data stays on this device, it just stops syncing.") && void signOut()
            }
          >
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Sync across devices</p>
      <p className="text-sm text-muted">
        Sign in with your email to back up your workouts and keep your phone and computer in sync. The app keeps
        working offline either way.
      </p>
      {step === "email" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await sendCode(email.trim());
              setStep("code");
            });
          }}
        >
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent"
          />
          <Button type="submit" disabled={busy || !email.includes("@")}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => verifyCode(email.trim(), code.trim()));
          }}
        >
          <p className="text-sm text-muted">
            We sent a code to <span className="text-text">{email}</span>. Enter it here, or tap the link in the
            email if you&apos;re in a browser.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            maxLength={10}
            className="tabular h-12 rounded-xl bg-surface-2 px-3 text-center text-2xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-accent"
          />
          <Button type="submit" disabled={busy || code.length < 6}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => {
              setStep("email");
              setCode("");
              setMsg(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}
      {msg && <p className="text-sm text-danger">{msg}</p>}
    </Card>
  );
}
