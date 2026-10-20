import type { StateStorage } from "zustand/middleware";

// Tiny IndexedDB key-value store used for guest saves; falls back to localStorage, then memory.
const DB = "our-little-hours", STORE = "kv";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  }));
}

const memory = new Map<string, string>();
const hasIdb = () => typeof indexedDB !== "undefined";
const ls = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };

export const idbStorage: StateStorage = {
  async getItem(k) {
    if (hasIdb()) try { return ((await tx("readonly", (s) => s.get(k))) as string | undefined) ?? null; } catch { /* fall through */ }
    return ls()?.getItem(k) ?? memory.get(k) ?? null;
  },
  async setItem(k, v) {
    if (hasIdb()) try { await tx("readwrite", (s) => s.put(v, k)); return; } catch { /* fall through */ }
    const l = ls(); if (l) l.setItem(k, v); else memory.set(k, v);
  },
  async removeItem(k) {
    if (hasIdb()) try { await tx("readwrite", (s) => s.delete(k)); return; } catch { /* fall through */ }
    ls()?.removeItem(k); memory.delete(k);
  },
};
