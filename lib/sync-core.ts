// Pure sync logic (no network, no React) so it can be tested on its own.
import type { DB } from "./types";

export type Kind = "routine" | "session" | "cardio" | "exercise" | "settings";

export type RemoteRow = {
  kind: Kind;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
};

export type PushRow = { kind: Kind; id: string; data: unknown; deleted: boolean };

/** What this device last agreed with the server, per record. */
export type SyncState = {
  /** server timestamp of the newest row we've pulled */
  lastPulledAt: string | null;
  /** "kind:id" -> stable JSON of the record as last synced */
  synced: Record<string, string>;
};

export const EMPTY_SYNC: SyncState = { lastPulledAt: null, synced: {} };

/** JSON with sorted keys, so Postgres jsonb key reordering doesn't look like a change. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
}

const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;

/** Every syncable record in the local database. */
export function localRecords(db: DB): Map<string, { kind: Kind; id: string; data: unknown }> {
  const out = new Map<string, { kind: Kind; id: string; data: unknown }>();
  const add = (kind: Kind, id: string, data: unknown) => out.set(keyOf(kind, id), { kind, id, data });
  db.routines.forEach((r) => add("routine", r.id, r));
  db.sessions.forEach((s) => add("session", s.id, s));
  db.cardio.forEach((c) => add("cardio", c.id, c));
  db.customExercises.forEach((e) => add("exercise", e.id, e));
  add("settings", "settings", db.settings);
  return out;
}

/** Records that changed or were deleted locally since the last sync. */
export function diffForPush(db: DB, state: SyncState): PushRow[] {
  const local = localRecords(db);
  const rows: PushRow[] = [];
  for (const [k, rec] of local) {
    if (state.synced[k] !== stable(rec.data)) rows.push({ ...rec, deleted: false });
  }
  for (const k of Object.keys(state.synced)) {
    if (!local.has(k)) {
      const [kind, ...rest] = k.split(":");
      rows.push({ kind: kind as Kind, id: rest.join(":"), data: {}, deleted: true });
    }
  }
  return rows;
}

/** Record that these rows are now on the server. */
export function markPushed(state: SyncState, rows: PushRow[]): SyncState {
  const synced = { ...state.synced };
  for (const r of rows) {
    if (r.deleted) delete synced[keyOf(r.kind, r.id)];
    else synced[keyOf(r.kind, r.id)] = stable(r.data);
  }
  return { ...state, synced };
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

/**
 * Apply rows pulled from the server. Rows that match what we already synced
 * (usually our own pushes coming back) are skipped.
 */
export function applyPulled(
  db: DB,
  state: SyncState,
  rows: RemoteRow[],
): { db: DB; state: SyncState; changed: boolean } {
  let next = db;
  const synced = { ...state.synced };
  let lastPulledAt = state.lastPulledAt;
  let changed = false;

  for (const row of rows) {
    if (!lastPulledAt || row.updated_at > lastPulledAt) lastPulledAt = row.updated_at;
    const k = keyOf(row.kind, row.id);

    if (row.deleted) {
      delete synced[k];
      const before = next;
      if (row.kind === "routine") next = { ...next, routines: next.routines.filter((x) => x.id !== row.id) };
      if (row.kind === "session") next = { ...next, sessions: next.sessions.filter((x) => x.id !== row.id) };
      if (row.kind === "cardio") next = { ...next, cardio: next.cardio.filter((x) => x.id !== row.id) };
      if (row.kind === "exercise")
        next = { ...next, customExercises: next.customExercises.filter((x) => x.id !== row.id) };
      // filter() always returns a new array, so compare lengths to see if anything went
      if (localRecords(before).size !== localRecords(next).size) changed = true;
      else next = before;
      continue;
    }

    const s = stable(row.data);
    if (synced[k] === s) continue;
    synced[k] = s;
    changed = true;
    const data = row.data as never;
    if (row.kind === "routine") next = { ...next, routines: upsertById(next.routines, data) };
    if (row.kind === "session")
      next = {
        ...next,
        sessions: upsertById(next.sessions, data as DB["sessions"][number]).sort((a, b) => a.startedAt - b.startedAt),
      };
    if (row.kind === "cardio")
      next = {
        ...next,
        cardio: upsertById(next.cardio, data as DB["cardio"][number]).sort((a, b) => a.date - b.date),
      };
    if (row.kind === "exercise") next = { ...next, customExercises: upsertById(next.customExercises, data) };
    if (row.kind === "settings") next = { ...next, settings: { ...next.settings, ...(data as object) } };
  }

  return { db: next, state: { lastPulledAt, synced }, changed };
}
