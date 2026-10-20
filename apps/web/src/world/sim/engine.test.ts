import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { advance, catchUp, createInitialState, allowedActivities, snapshot, isSimState, MAX_CATCH_UP_MS, type SimContext, type SimState, type Segment, type ActivitiesDoc } from "./engine";
import { buildNav, findPath, pathLength, pointAlong } from "./nav";
import { localParts, parseHM, inWindow } from "./time";
import activities from "@content/world/activities.json";
import study from "@content/locations/study.json";
import type { LocationManifest } from "@/world/locations/schema";

const ctx: SimContext = { tzOffsetMin: 0, defs: activities as unknown as ActivitiesDoc, nav: buildNav(study as unknown as LocationManifest) };
const MON = Date.UTC(2026, 9, 19, 6, 0); // Monday 06:00 UTC
const H = 3_600_000, DAY = 24 * H;

/** Collect every segment from start to `until`, one segment per step. */
function run(seed: number, start: number, until: number) {
  let s = createInitialState(seed, start, ctx);
  const segs: Segment[] = [s.current];
  while (s.current.end < until) { s = advance(s, s.current.end, ctx); segs.push(s.current); }
  return { segs, state: s };
}

describe("life engine: a simulated week", () => {
  const { segs } = run(42, MON, MON + 7 * DAY);
  const acts = segs.filter((g) => g.kind !== "walking");

  it("segments are back to back with no gaps or overlaps", () => {
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBe(segs[i - 1].end);
      expect(segs[i].end).toBeGreaterThan(segs[i].start);
    }
  });

  it("she only does things at the right spot, walking there first (no impossible transitions)", () => {
    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1], cur = segs[i];
      if (cur.kind === "walking") {
        expect(cur.from).toBe(prev.anchor);
        expect(cur.anchor).not.toBe(cur.from);
        expect(segs[i + 1]?.kind ?? cur.next).toBe(cur.next);
      } else {
        expect(cur.anchor).toBe(ctx.defs.activities[cur.kind].anchor);
        expect(prev.anchor).toBe(cur.anchor); // arrived (by walking) or already there
      }
    }
  });

  it("sleeps every night and only inside the sleep window", () => {
    for (const g of acts.filter((a) => a.kind === "sleeping")) {
      const p = localParts(g.start, 0);
      const [from, to] = (p.weekend ? ctx.defs.sleepWindow.weekend : ctx.defs.sleepWindow.weekday).map(parseHM);
      expect(inWindow(p.minuteOfDay, from, to)).toBe(true);
    }
    for (let d = 1; d < 7; d++) {
      const t = MON - 6 * H + d * DAY + 3 * H; // 03:00 each night
      expect(acts.find((a) => a.start <= t && a.end > t)?.kind).toBe("sleeping");
    }
  });

  it("does every daytime activity and never repeats one three times in a row", () => {
    for (const id of ["studying", "reading", "relaxing", "tea", "window"]) expect(acts.some((a) => a.kind === id)).toBe(true);
    for (let i = 2; i < acts.length; i++) {
      if (acts[i].kind === "sleeping") continue;
      expect(acts[i].kind === acts[i - 1].kind && acts[i].kind === acts[i - 2].kind).toBe(false);
    }
  });

  it("follows weekday vs weekend routines (more studying on weekdays)", () => {
    const studyMin = (weekend: boolean) => acts.filter((a) => a.kind === "studying" && localParts(a.start, 0).weekend === weekend)
      .reduce((m, a) => m + (a.end - a.start) / 60_000, 0) / (weekend ? 2 : 5);
    expect(studyMin(false)).toBeGreaterThan(studyMin(true) * 1.5);
  });
});

describe("life engine: determinism and offline progression", () => {
  it("same seed gives the same life; a different seed gives a different one", () => {
    const a = run(7, MON, MON + 2 * DAY).segs.map((g) => `${g.kind}@${g.start}`);
    expect(run(7, MON, MON + 2 * DAY).segs.map((g) => `${g.kind}@${g.start}`)).toEqual(a);
    expect(run(8, MON, MON + 2 * DAY).segs.map((g) => `${g.kind}@${g.start}`)).not.toEqual(a);
  });

  it("advancing in one jump equals advancing minute by minute (catch-up is exact)", () => {
    const start = createInitialState(3, MON, ctx);
    const jump = advance(start, MON + 6 * H, ctx);
    let stepped: SimState = start;
    for (let t = MON; t <= MON + 6 * H; t += 60_000) stepped = advance(stepped, t, ctx);
    expect(stepped).toEqual(jump);
  });

  it("catch-up is bounded to 7 days and fast after a month away", () => {
    const s = createInitialState(5, MON, ctx);
    const t0 = performance.now();
    const { state, skippedMs } = catchUp(s, MON + 30 * DAY, ctx);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(skippedMs).toBe(30 * DAY - MAX_CATCH_UP_MS);
    expect(state.now).toBe(MON + 30 * DAY);
    expect(state.events[0].at).toBeGreaterThan(MON + 23 * DAY - 1);
    expect(isSimState(state)).toBe(true);
  });

  it("needs stay within 0–100 and energy recovers overnight", () => {
    let s = createInitialState(9, MON, ctx);
    s = advance(s, MON + 17 * H, ctx); // Monday 23:00
    const evening = s.needs.energy;
    s = advance(s, MON + 26 * H, ctx); // Tuesday 08:00
    for (const v of Object.values(s.needs)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect(s.needs.energy).toBeGreaterThan(evening);
  });

  it("won't study when exhausted", () => {
    const s = createInitialState(1, MON + 4 * H, ctx); // Monday 10:00
    s.needs.energy = 10;
    expect(allowedActivities(s, MON + 4 * H, ctx)).not.toContain("studying");
  });

  it("snapshot reports walking with a path, and SLEEPING availability at night", () => {
    const { segs } = run(42, MON, MON + 2 * DAY);
    const walk = segs.find((g) => g.kind === "walking")!;
    const snap = snapshot({ ...createInitialState(42, MON, ctx), current: walk, anchor: walk.anchor }, ctx);
    expect(snap.pose).toBe("walk"); expect(snap.walk?.path.length).toBeGreaterThan(1);
    const night = advance(createInitialState(42, MON, ctx), MON + 21 * H, ctx); // 03:00
    expect(snapshot(night, ctx).availability).toBe("SLEEPING");
  });
});

describe("navigation", () => {
  it("finds paths between every pair of anchors via waypoints", () => {
    const ids = ["desk", "reading", "window", "tea"] as const;
    for (const a of ids) for (const b of ids) if (a !== b) {
      const p = findPath(ctx.nav, a, b)!;
      expect(p[0]).toEqual(study.anchors[a].pos); expect(p.at(-1)).toEqual(study.anchors[b].pos);
      expect(pathLength(p)).toBeLessThan(12);
    }
  });
  it("pointAlong walks from start to end with a heading", () => {
    const p = findPath(ctx.nav, "desk", "tea")!;
    expect(pointAlong(p, 0).pos).toEqual(p[0]);
    expect(pointAlong(p, 1).pos).toEqual(p.at(-1));
    expect(Number.isFinite(pointAlong(p, 0.5).yaw)).toBe(true);
  });
});

describe("sim purity", () => {
  it("never reads the clock or Math.random (so it stays deterministic)", () => {
    const dir = path.dirname(new URL(import.meta.url).pathname);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
      const src = readFileSync(path.join(dir, f), "utf8");
      expect(src, f).not.toMatch(/Date\.now\(|new Date\(|Math\.random\(|performance\.now\(/);
    }
  });
});
