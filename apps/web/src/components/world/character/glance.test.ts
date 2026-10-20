import { describe, it, expect } from "vitest";
import { GlanceScheduler, headTurnToward, DEFAULT_GLANCE } from "./glance";

describe("occasional glances", () => {
  it("glances every 20–45 s for about 2.5 s, easing in and out", () => {
    const g = new GlanceScheduler(1, 0);
    const starts: number[] = []; let prev = 0;
    for (let t = 0; t < 600; t += 0.1) { const w = g.weight(t, true); if (w > 0 && prev === 0) starts.push(t); prev = w; }
    expect(starts.length).toBeGreaterThanOrEqual(12); expect(starts.length).toBeLessThanOrEqual(26);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i] - starts[i - 1];
      expect(gap).toBeGreaterThanOrEqual(DEFAULT_GLANCE.minGap); expect(gap).toBeLessThanOrEqual(DEFAULT_GLANCE.maxGap + 3.6);
    }
  });
  it("is smooth: no jumps bigger than a small step per frame", () => {
    const g = new GlanceScheduler(2, 0); g.glanceNow(0);
    let prev = 0;
    for (let t = 0; t < 5; t += 1 / 60) { const w = g.weight(t, true); expect(Math.abs(w - prev)).toBeLessThan(0.06); prev = w; }
  });
  it("never starts while asleep/walking, and an interrupted glance fades out instead of snapping", () => {
    const asleep = new GlanceScheduler(3, 0); asleep.glanceNow(0);
    expect(asleep.weight(0.1, false)).toBe(0);
    const g = new GlanceScheduler(3, 0); g.glanceNow(0);
    g.weight(0, true); // glance starts
    expect(g.weight(1.5, true)).toBe(1);
    let prev = 1;
    for (let t = 1.5 + 1 / 60; t < 3; t += 1 / 60) { const w = g.weight(t, false); expect(w).toBeLessThanOrEqual(prev + 1e-9); expect(prev - w).toBeLessThan(0.06); prev = w; }
    expect(prev).toBe(0);
  });
  it("turns the head toward the viewer, within what a neck can do", () => {
    const front = headTurnToward([0, 1.2, 0], 0, [0, 1.2, 3]);
    expect(front.yaw).toBeCloseTo(0); expect(front.pitch).toBeCloseTo(0);
    const right = headTurnToward([0, 1.2, 0], 0, [3, 1.2, 3]);
    expect(right.yaw).toBeCloseTo(Math.PI / 4);
    const behind = headTurnToward([0, 1.2, 0], 0, [0, 1.2, -3]);
    expect(Math.abs(behind.yaw)).toBeCloseTo(1.2); // clamped: she can't look straight backwards
    expect(headTurnToward([0, 1.2, 0], 0, [0, 9, 1]).pitch).toBeCloseTo(0.44);
  });
});
