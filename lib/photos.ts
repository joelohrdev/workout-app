"use client";

// Progress photos live in IndexedDB on this device only (they're too big for
// localStorage and aren't synced).

export type Photo = { id: string; date: number; blob: Blob };

const DB_NAME = "homegym-photos";
const STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listPhotos(): Promise<Photo[]> {
  const all = await tx<Photo[]>("readonly", (s) => s.getAll() as IDBRequest<Photo[]>);
  return all.sort((a, b) => b.date - a.date);
}

export function deletePhoto(id: string) {
  return tx("readwrite", (s) => s.delete(id));
}

/** Shrink to at most 1280px on the long side and save as JPEG. */
export async function addPhoto(file: File): Promise<void> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't process photo"))), "image/jpeg", 0.82),
  );
  const photo: Photo = { id: crypto.randomUUID(), date: file.lastModified || Date.now(), blob };
  await tx("readwrite", (s) => s.put(photo));
}
