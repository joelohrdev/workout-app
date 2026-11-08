"use client";

import { useSyncExternalStore } from "react";
import { seedRoutines } from "./seed";
import type { DB } from "./types";

const KEY = "homegym:v1";

const EMPTY: DB = {
  version: 1,
  routines: [],
  sessions: [],
  cardio: [],
  customExercises: [],
  activeSession: null,
  timers: {},
  settings: { weightUnit: "lb", distanceUnit: "mi", restSound: true, restSec: 30 },
};

let cache: DB | null = null;
const listeners = new Set<() => void>();

function fresh(): DB {
  return { ...EMPTY, routines: seedRoutines(Date.now()) };
}

function load(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as DB;
      // merge settings so newly added options get their defaults
      cache = { ...EMPTY, ...saved, settings: { ...EMPTY.settings, ...saved.settings } };
    } else cache = fresh();
    if (!raw) persist(cache);
  } catch {
    cache = fresh();
  }
  return cache;
}

function persist(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked — keep working in memory
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const changeListeners = new Set<(fromSync: boolean) => void>();

/** Called after every local write; `fromSync` is true for changes pulled from the cloud. */
export function onChange(cb: (fromSync: boolean) => void) {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

/** Apply an immutable update to the database and notify subscribers. */
export function update(fn: (db: DB) => DB, opts?: { fromSync?: boolean }) {
  const prev = load();
  cache = fn(prev);
  if (cache === prev) return;
  persist(cache);
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l(!!opts?.fromSync));
}

export function replaceAll(db: DB) {
  update(() => ({ ...EMPTY, ...db, settings: { ...EMPTY.settings, ...db.settings } }));
}

export function resetAll() {
  update(() => fresh());
}

export function getDB(): DB {
  return load();
}

/** The whole database. Returns an empty placeholder during server render. */
export function useDB(): DB {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

const noop = () => () => {};
/** false on the server and during hydration, true once mounted in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
