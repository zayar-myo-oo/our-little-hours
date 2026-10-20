// Proves the rollback promise: a build from BEFORE M0 can still read saves written by M0+.
import { describe, it, expect } from "vitest";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { memoryStorage } from "@/test/memoryStorage";

type Old = { tasks: { id: string; title: string }[]; settings: { musicVolume: number } };

/** The persist config exactly as shipped before M0 (no version, no migrate, shallow merge). */
function preM0Store(storage: ReturnType<typeof memoryStorage>["storage"]) {
  return create<Old>()(persist((): Old => ({ tasks: [], settings: { musicVolume: 0.6 } }), {
    name: "olh-save-v1",
    storage: createJSONStorage(() => storage),
    merge: (p, current) => ({ ...current, ...(p as Partial<Old>), settings: { ...current.settings, ...(p as Partial<Old>)?.settings } }),
  }));
}

describe("rollback compatibility", () => {
  it("a pre-M0 build loads an M0 save instead of resetting it", async () => {
    const m0Save = JSON.stringify({ state: { __schema: 1, tasks: [{ id: "a", title: "Keep me" }], settings: { musicVolume: 0.2 } }, version: 0 });
    const { storage } = memoryStorage({ "olh-save-v1": m0Save });
    const old = preM0Store(storage);
    await old.persist.rehydrate();
    expect(old.getState().tasks).toEqual([{ id: "a", title: "Keep me" }]);
    expect(old.getState().settings.musicVolume).toBe(0.2);
  });

  it("(why the envelope stays 0) a version-1 envelope WOULD be reset by a pre-M0 build", async () => {
    const devM0Save = JSON.stringify({ state: { tasks: [{ id: "a", title: "Lost" }] }, version: 1 });
    const { storage } = memoryStorage({ "olh-save-v1": devM0Save });
    const old = preM0Store(storage);
    const err = console.error; console.error = () => {};
    await old.persist.rehydrate();
    console.error = err;
    expect(old.getState().tasks).toEqual([]);
  });
});
