// Backup-before-migration and recovery for persisted saves.
// Wraps any zustand StateStorage; never deletes user data except old backups beyond the retention cap.
import type { StateStorage } from "zustand/middleware";
import { inspectRaw, type RawKind } from "./schema";

export interface BackupEntry { key: string; reason: Exclude<RawKind, "empty" | "current"> | "manual"; fromVersion: number | null; createdAt: number }

export const MAX_BACKUPS = 5;
const indexKey = (name: string) => `${name}.backups`;

async function readIndex(storage: StateStorage, name: string): Promise<BackupEntry[]> {
  try {
    const raw = await storage.getItem(indexKey(name));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.key === "string") : [];
  } catch { return []; }
}

/** Copy the raw value to a new backup key. Returns the backup key. */
export async function backupRaw(storage: StateStorage, name: string, raw: string, reason: BackupEntry["reason"], fromVersion: number | null, now = Date.now()): Promise<string> {
  const key = `${name}.backup.${reason}.${now}`;
  await storage.setItem(key, raw);
  const list = [...(await readIndex(storage, name)).filter((e) => e.key !== key), { key, reason, fromVersion, createdAt: now }];
  const keep = list.slice(-MAX_BACKUPS);
  for (const old of list.slice(0, Math.max(0, list.length - MAX_BACKUPS))) await storage.removeItem(old.key);
  await storage.setItem(indexKey(name), JSON.stringify(keep));
  return key;
}

export const listBackups = (storage: StateStorage, name: string) => readIndex(storage, name);

/** Restore a backup into the main key. The current value is backed up first, so restoring is reversible. */
export async function restoreBackup(storage: StateStorage, name: string, key: string, now = Date.now()): Promise<boolean> {
  const entry = (await readIndex(storage, name)).find((e) => e.key === key);
  const raw = entry ? await storage.getItem(key) : null;
  if (!raw) return false;
  const current = await storage.getItem(name);
  if (current) await backupRaw(storage, name, current, "manual", inspectRaw(current).version, now);
  await storage.setItem(name, raw);
  return true;
}

export interface VersionedStorageEvents { onBackup?: (entry: { key: string; kind: RawKind; version: number | null }) => void }

/**
 * Storage wrapper used by the game store. On read, if the stored save is legacy, from a future version or
 * malformed, the untouched raw text is backed up before zustand migrates or overwrites it.
 * Malformed data is hidden from zustand (returns null) so the app starts with defaults instead of crashing.
 * A save from a NEWER app version is loaded best-effort but never written back (read-only for the session),
 * so opening an older build can't overwrite newer data.
 */
export type VersionedStorage = StateStorage & { isReadOnly(name: string): boolean };

export function createVersionedStorage(base: StateStorage, events: VersionedStorageEvents = {}, now = () => Date.now()): VersionedStorage {
  const backedUp = new Set<string>();
  const readOnly = new Set<string>(); // keys we failed to back up: never write over them this session
  return {
    isReadOnly: (name) => readOnly.has(name),
    async getItem(name) {
      const raw = await base.getItem(name);
      const { kind, version } = inspectRaw(raw);
      if ((kind === "legacy" || kind === "future" || kind === "malformed") && raw && !backedUp.has(name)) {
        try {
          const key = await backupRaw(base, name, raw, kind, version, now());
          backedUp.add(name);
          events.onBackup?.({ key, kind, version });
          if (kind === "future") readOnly.add(name);
        } catch (e) {
          // If we cannot back up, refuse to hand data to the migrator: keep the original untouched and run on defaults.
          console.warn("[save] backup failed; starting with defaults and leaving stored data untouched", e);
          readOnly.add(name);
          return null;
        }
      }
      return kind === "malformed" ? null : raw;
    },
    async setItem(name, value) { if (!readOnly.has(name)) await base.setItem(name, value); },
    async removeItem(name) { if (!readOnly.has(name)) await base.removeItem(name); },
  };
}
