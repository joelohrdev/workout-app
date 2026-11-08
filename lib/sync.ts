"use client";

import type { Session as AuthSession } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getDB, onChange, update } from "./store";
import { getSupabase, syncConfigured } from "./supabase";
import {
  EMPTY_SYNC,
  applyPulled,
  diffForPush,
  markPushed,
  type RemoteRow,
  type SyncState,
} from "./sync-core";

const STATE_KEY = "homegym:sync";
const TABLE = "gym_records";
const PAGE = 1000;
const PUSH_CHUNK = 500;

export type SyncStatus = {
  configured: boolean;
  /** signed-in email, or null */
  email: string | null;
  phase: "idle" | "syncing" | "error" | "offline";
  error: string | null;
  lastSyncedAt: number | null;
};

let status: SyncStatus = {
  configured: syncConfigured,
  email: null,
  phase: "idle",
  error: null,
  lastSyncedAt: null,
};
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => status,
    () => status,
  );
}

function readState(): SyncState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? { ...EMPTY_SYNC, ...JSON.parse(raw) } : EMPTY_SYNC;
  } catch {
    return EMPTY_SYNC;
  }
}
function writeState(s: SyncState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {}
}

async function pull(state: SyncState): Promise<SyncState> {
  const sb = getSupabase()!;
  let rows: RemoteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from(TABLE)
      .select("kind,id,data,deleted,updated_at")
      .order("updated_at", { ascending: true })
      .order("kind")
      .order("id")
      .range(from, from + PAGE - 1);
    // gte, not gt: rows written in one batch share a timestamp. Re-reading one is harmless.
    if (state.lastPulledAt) q = q.gte("updated_at", state.lastPulledAt);
    const { data, error } = await q;
    if (error) throw error;
    rows = rows.concat(data as RemoteRow[]);
    if (!data || data.length < PAGE) break;
  }
  if (!rows.length) return state;

  let next = state;
  update(
    (db) => {
      const res = applyPulled(db, state, rows);
      next = res.state;
      return res.changed ? res.db : db;
    },
    { fromSync: true },
  );
  return next;
}

async function push(state: SyncState): Promise<SyncState> {
  const sb = getSupabase()!;
  const rows = diffForPush(getDB(), state);
  let next = state;
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK);
    const { error } = await sb.from(TABLE).upsert(chunk, { onConflict: "user_id,kind,id" });
    if (error) throw error;
    next = markPushed(next, chunk);
    writeState(next);
  }
  return next;
}

let running: Promise<void> | null = null;
let again = false;

/** Push local changes and pull remote ones. Safe to call often. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const sb = getSupabase();
  if (!sb || !status.email) return;
  if (!navigator.onLine) {
    setStatus({ phase: "offline" });
    return;
  }
  setStatus({ phase: "syncing", error: null });
  try {
    let state = readState();
    if (!state.lastPulledAt) {
      // First sync on this device: take the cloud's copy first so fresh
      // starter routines here don't overwrite routines edited elsewhere,
      // then upload anything that only exists on this device.
      state = await pull(state);
      writeState(state);
      state = await push(state);
    } else {
      // Normal sync: this device's edits win, then catch up on the rest.
      state = await push(state);
      state = await pull(state);
    }
    writeState(state);
    setStatus({ phase: "idle", lastSyncedAt: Date.now() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    setStatus({ phase: navigator.onLine ? "error" : "offline", error: msg });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleSync(delay = 2000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

function onAuth(session: AuthSession | null) {
  const email = session?.user.email ?? null;
  const changedUser = email !== status.email;
  setStatus({ email });
  if (email && changedUser) void syncNow();
}

let started = false;
/** Wire up auth + automatic syncing. Called once from the root layout. */
export function startSync() {
  if (started) return;
  started = true;
  const sb = getSupabase();
  if (!sb) return;

  sb.auth.getSession().then(({ data }) => onAuth(data.session));
  sb.auth.onAuthStateChange((_event, session) => onAuth(session));

  onChange((fromSync) => {
    if (!fromSync && status.email) scheduleSync();
  });
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
}

export async function sendCode(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync isn't configured");
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/settings` },
  });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Sync isn't configured");
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  await sb?.auth.signOut();
  // Local data stays; forget sync bookkeeping so signing in again starts clean.
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {}
  setStatus({ email: null, phase: "idle", error: null, lastSyncedAt: null });
}
