import { describe, it, expect } from "vitest";
import { createWorldPersistence, WORLD_KEY, WORLD_VERSION } from "./worldPersistence";
import { memoryStorage } from "@/test/memoryStorage";

describe("world persistence (olh-world-v1)", () => {
  it("starts empty, round-trips and keeps createdAt", async () => {
    const { storage } = memoryStorage();
    const w = createWorldPersistence<{ n: number }>(storage, (s): s is { n: number } => typeof (s as { n?: unknown })?.n === "number");
    expect(await w.load()).toEqual({ status: "empty" });
    await w.save({ n: 1 }, 100);
    await w.save({ n: 2 }, 200);
    expect(await w.load()).toEqual({ status: "ok", save: { version: WORLD_VERSION, createdAt: 100, updatedAt: 200, sim: { n: 2 } } });
  });

  it("never touches the game save key", async () => {
    const game = JSON.stringify({ state: { tasks: [{ id: "a" }] }, version: 1 });
    const { storage, data, touched } = memoryStorage({ "olh-save-v1": game });
    const w = createWorldPersistence(storage);
    await w.load(); await w.save(null); await w.clear();
    expect(touched.has("olh-save-v1")).toBe(false);
    expect(data.get("olh-save-v1")).toBe(game);
    expect(data.has(WORLD_KEY)).toBe(false);
  });

  it("backs up malformed data", async () => {
    const { storage, data } = memoryStorage({ [WORLD_KEY]: "{oops" });
    const r = await createWorldPersistence(storage).load();
    expect(r.status).toBe("malformed");
    expect(r.status === "malformed" && data.get(r.backupKey!)).toBe("{oops");
  });

  it("refuses to overwrite a save from a newer version", async () => {
    const raw = JSON.stringify({ version: 7, createdAt: 1, updatedAt: 1, sim: { future: true } });
    const { storage, data } = memoryStorage({ [WORLD_KEY]: raw });
    const w = createWorldPersistence(storage);
    expect((await w.load()).status).toBe("future");
    await expect(w.save(null)).rejects.toThrow(/newer version/);
    await w.clear();
    expect(data.get(WORLD_KEY)).toBe(raw);
  });
});
