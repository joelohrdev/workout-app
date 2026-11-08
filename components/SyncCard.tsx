"use client";

import { useState } from "react";
import { formatTime } from "@/lib/format";
import { signInWithPassword, signOut, signUpWithPassword, syncNow, useSyncStatus } from "@/lib/sync";
import { Button, Card, Segmented } from "./ui";

export function SyncCard() {
  const s = useSyncStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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

  const submit = () =>
    run(async () => {
      if (mode === "signin") return signInWithPassword(email.trim(), password);
      const signedIn = await signUpWithPassword(email.trim(), password);
      if (!signedIn)
        setMsg(
          "Account created, but Supabase wants the email confirmed first. Turn off “Confirm email” in Supabase (Authentication → Sign In / Providers → Email), then sign in.",
        );
    });

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Sync across devices</p>
      <div>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setMsg(null);
          }}
          options={[
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ]}
        />
      </div>
      <p className="text-sm text-muted">
        Back up your workouts and keep your phone and computer in sync. Use the same email and password on each
        device. The app keeps working offline either way.
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="email"
          name="email"
          required
          autoComplete={mode === "signin" ? "username" : "email"}
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="password"
          name="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signin" ? "Password" : "Choose a password (8+ characters)"}
          className="h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent"
        />
        <Button
          type="submit"
          disabled={busy || !email.includes("@") || password.length < (mode === "signup" ? 8 : 1)}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
      {(msg ?? s.linkError) && <p className="text-sm text-danger">{msg ?? s.linkError}</p>}
    </Card>
  );
}
