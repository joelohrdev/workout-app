"use client";

import { useSyncExternalStore } from "react";
import { getDB, onChange } from "./store";
import { getSupabase, syncConfigured } from "./supabase";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Push needs the VAPID key, Supabase sign-in, and browser support. */
export const pushConfigured = !!VAPID && syncConfigured;

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

let state: PushState = "off";
const listeners = new Set<() => void>();
function setState(s: PushState) {
  state = s;
  listeners.forEach((l) => l());
}
export function usePushState(): PushState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => "off",
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

async function token(): Promise<string | null> {
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

async function api(path: string, method: string, body: unknown, keepalive = false) {
  const t = await token();
  if (!t) throw new Error("Sign in to sync first");
  const res = await fetch(path, {
    method,
    keepalive,
    headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
}

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Work out the current state without prompting. */
export async function refreshPushState() {
  if (!pushConfigured || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    setState(isIOS() && !standalone() ? "needs-install" : "unsupported");
    return;
  }
  if (Notification.permission === "denied") return setState("denied");
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  setState(sub ? "on" : "off");
}

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    setState(perm === "denied" ? "denied" : "off");
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }));
  await api("/api/push/subscribe", "POST", sub.toJSON());
  setState("on");
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/api/push/subscribe", "DELETE", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  setState("off");
}

let started = false;
let alertFor: number | null = null;

/**
 * When the app goes to the background mid-rest, ask the server to send a
 * notification when the rest ends. Cancel it when the app comes back.
 */
export function startRestAlerts() {
  if (started || !pushConfigured) return;
  started = true;
  void refreshPushState();

  const cancel = () => {
    if (alertFor === null) return;
    alertFor = null;
    void api("/api/push/rest", "DELETE", {}, true).catch(() => {});
  };

  document.addEventListener("visibilitychange", () => {
    if (state !== "on") return;
    if (document.visibilityState === "hidden") {
      const endsAt = getDB().activeSession?.restEndsAt;
      if (endsAt && endsAt - Date.now() > 3000) {
        alertFor = endsAt;
        void api("/api/push/rest", "POST", { endsAt }, true).catch(() => (alertFor = null));
      }
    } else cancel();
  });
  // rest skipped/finished while the alert was pending
  onChange(() => {
    if (alertFor !== null && getDB().activeSession?.restEndsAt !== alertFor && document.visibilityState === "visible")
      cancel();
  });
}
