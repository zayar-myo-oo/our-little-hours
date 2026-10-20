// Separate persistence for the Living World (`olh-world-v1`). Interface only in M0: no live world state is written yet.
// It is fully isolated from the game save (`olh-save-v1`): it never reads, writes or removes that key.
import type { StateStorage } from "zustand/middleware";
import { SAVE_KEY } from "@/store/save/schema";
import { backupRaw } from "@/store/save/recovery";

export const WORLD_KEY = "olh-world-v1";
export const WORLD_VERSION = 1;

/** Envelope for world saves. `sim` is filled in by M1-C (life engine); M0 only defines and validates the envelope. */
export interface WorldSave<Sim = unknown> { version: number; createdAt: number; updatedAt: number; sim: Sim | null }

export type WorldLoadResult<Sim> =
  | { status: "empty" }
  | { status: "ok"; save: WorldSave<Sim> }
  | { status: "malformed"; backupKey: string | null }
  | { status: "future"; version: number; backupKey: string | null };

export interface WorldPersistence<Sim = unknown> {
  readonly key: typeof WORLD_KEY;
  load(): Promise<WorldLoadResult<Sim>>;
  save(sim: Sim | null, now?: number): Promise<WorldSave<Sim>>;
  clear(): Promise<void>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function createWorldPersistence<Sim = unknown>(storage: StateStorage, validateSim: (s: unknown) => s is Sim = (_s): _s is Sim => true): WorldPersistence<Sim> {
  if ((WORLD_KEY as string) === SAVE_KEY) throw new Error("world key must differ from the game save key");
  let futureLocked = false; // never overwrite a save written by a newer app version
  return {
    key: WORLD_KEY,
    async load() {
      const raw = await storage.getItem(WORLD_KEY);
      if (raw == null || raw === "") return { status: "empty" };
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
      const valid = isObj(parsed) && Number.isInteger(parsed.version) && typeof parsed.createdAt === "number" && typeof parsed.updatedAt === "number"
        && (parsed.sim === null || validateSim(parsed.sim));
      if (isObj(parsed) && Number.isInteger(parsed.version) && (parsed.version as number) > WORLD_VERSION) {
        futureLocked = true;
        return { status: "future", version: parsed.version as number, backupKey: await safeBackup(storage, raw, "future", parsed.version as number) };
      }
      if (!valid) return { status: "malformed", backupKey: await safeBackup(storage, raw, "malformed", null) };
      return { status: "ok", save: parsed as unknown as WorldSave<Sim> };
    },
    async save(sim, now = Date.now()) {
      if (futureLocked) throw new Error("world save is from a newer version; refusing to overwrite");
      let createdAt = now;
      try { const prev = JSON.parse((await storage.getItem(WORLD_KEY)) ?? "null"); if (isObj(prev) && typeof prev.createdAt === "number") createdAt = prev.createdAt; } catch { /* keep now */ }
      const save: WorldSave<Sim> = { version: WORLD_VERSION, createdAt, updatedAt: now, sim };
      await storage.setItem(WORLD_KEY, JSON.stringify(save));
      return save;
    },
    async clear() { if (!futureLocked) await storage.removeItem(WORLD_KEY); },
  };
}

async function safeBackup(storage: StateStorage, raw: string, reason: "future" | "malformed", version: number | null) {
  try { return await backupRaw(storage, WORLD_KEY, raw, reason, version); } catch { return null; }
}
