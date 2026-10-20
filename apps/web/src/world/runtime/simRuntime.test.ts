import { describe, it, expect } from "vitest";
import { SimRuntime } from "./simRuntime";
import { memoryStorage } from "@/test/memoryStorage";
import { buildNav } from "@/world/sim/nav";
import type { ActivitiesDoc, SimSnapshot } from "@/world/sim/engine";
import activities from "@content/world/activities.json";
import study from "@content/locations/study.json";
import type { LocationManifest } from "@/world/locations/schema";

const ctx = { defs: activities as unknown as ActivitiesDoc, nav: buildNav(study as unknown as LocationManifest) };
const MON = Date.UTC(2026, 9, 19, 9, 0), H = 3_600_000;
const deps = (storage: ReturnType<typeof memoryStorage>["storage"], clock: { t: number }) =>
  ({ storage, ctx, now: () => clock.t, tzOffsetMin: () => 0, newSeed: () => 1234 });

describe("SimRuntime", () => {
  it("starts fresh, saves only to olh-world-v1, and resumes where it left off after time away", async () => {
    const mem = memoryStorage({ "olh-save-v1": "GAME DATA" }), clock = { t: MON };
    const a = new SimRuntime(deps(mem.storage, clock));
    expect((await a.start()).status).toBe("new");
    clock.t += 5 * H; a.tick(); await a.save();
    expect(mem.data.get("olh-save-v1")).toBe("GAME DATA");
    expect([...mem.touched].filter((k) => k.startsWith("olh-save-v1"))).toEqual([]);

    clock.t += 3 * H; // app closed for 3 hours
    const b = new SimRuntime(deps(mem.storage, clock));
    const r = await b.start();
    expect(r.status).toBe("resumed");
    expect(r.awayMs).toBe(3 * H);
    expect(b.current!.now).toBe(clock.t);
    expect(b.current!.events.some((e) => e.at > MON + 5 * H)).toBe(true); // she kept living while away
  });

  it("recovers from a corrupted world save (backed up) without touching game data", async () => {
    const mem = memoryStorage({ "olh-world-v1": "{broken", "olh-save-v1": "GAME DATA" }), clock = { t: MON };
    const rt = new SimRuntime(deps(mem.storage, clock));
    expect((await rt.start()).status).toBe("recovered");
    expect([...mem.data.keys()].some((k) => k.startsWith("olh-world-v1.backup.malformed"))).toBe(true);
    expect(mem.data.get("olh-save-v1")).toBe("GAME DATA");
  });

  it("runs read-only on a world save from a newer version", async () => {
    const newer = JSON.stringify({ version: 9, createdAt: 1, updatedAt: 1, sim: {} });
    const mem = memoryStorage({ "olh-world-v1": newer }), clock = { t: MON };
    const rt = new SimRuntime(deps(mem.storage, clock));
    expect((await rt.start()).status).toBe("read-only");
    clock.t += H; rt.tick(); await rt.save();
    expect(mem.data.get("olh-world-v1")).toBe(newer);
  });

  it("notifies listeners only when what she's doing changes", async () => {
    const mem = memoryStorage(), clock = { t: MON };
    const rt = new SimRuntime(deps(mem.storage, clock));
    await rt.start();
    const seen: SimSnapshot[] = [];
    rt.subscribe((s) => seen.push(s));
    for (let i = 0; i < 30; i++) { clock.t += 1000; rt.tick(); } // 30 s: usually no change
    const changes = seen.length;
    clock.t += 4 * H; rt.tick();
    expect(seen.length).toBe(changes + 1);
  });
});
