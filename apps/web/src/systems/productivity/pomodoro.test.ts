import { describe, it, expect } from "vitest";
import * as P from "./pomodoro";
const c = P.DEFAULT_CONFIG;

describe("pomodoro", () => {
  it("starts, pauses and preserves remaining time", () => {
    let s = P.start(P.initialState(c), 0);
    expect(P.remaining(s, 60_000)).toBe(24 * 60_000);
    s = P.pause(s, 60_000);
    expect(s.running).toBe(false);
    expect(P.remaining(s, 999_999)).toBe(24 * 60_000);
    s = P.start(s, 100_000);
    expect(s.endsAt).toBe(100_000 + 24 * 60_000);
  });
  it("reset restores full phase duration", () => {
    const s = P.reset(P.pause(P.start(P.initialState(c), 0), 5000), c);
    expect(s.remainingMs).toBe(25 * 60_000);
  });
  it("moves focus -> short break, and every 4th to long break", () => {
    let s = P.initialState(c);
    const phases: string[] = [];
    let now = 0;
    for (let i = 0; i < 8; i++) {
      s = P.start(s, now); now += s.remainingMs;
      const r = P.tick(s, now, c); s = r.state; phases.push(s.phase);
    }
    expect(phases).toEqual(["shortBreak", "focus", "shortBreak", "focus", "shortBreak", "focus", "longBreak", "focus"]);
    expect(s.completedFocus).toBe(4);
  });
  it("tick does nothing before the end", () => {
    const s = P.start(P.initialState(c), 0);
    expect(P.tick(s, 1000, c).finished).toBeNull();
  });
  it("formats time", () => { expect(P.formatMs(25 * 60_000)).toBe("25:00"); expect(P.formatMs(61_500)).toBe("01:02"); });
});
