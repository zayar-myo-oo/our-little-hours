import { describe, it, expect } from "vitest";
import { summarizeAway, formatDuration, formatTimes, MIN_AWAY_MS, type AwayLines } from "./away";
import type { SimEvent } from "./engine";
import lines from "@content/world/away-lines.json";

const L = lines as AwayLines;
const T0 = Date.UTC(2026, 9, 19, 8);
const ev = (minAfter: number, activity: SimEvent["activity"], minutes: number): SimEvent => ({ at: T0 + minAfter * 60_000, kind: "activity", activity, anchor: "desk", minutes });

describe("While you were away", () => {
  it("summarizes only activities that actually happened in the absence, biggest first, 2–4 lines", () => {
    const events = [ev(-30, "window", 60), ev(40, "studying", 40), ev(80, "reading", 30), ev(95, "tea", 10), ev(140, "studying", 45), ev(150, "window", 8)];
    const s = summarizeAway(events, T0, T0 + 3 * 3_600_000, L)!;
    expect(s.highlights.map((h) => h.activity)).toEqual(["studying", "reading", "tea", "window"]);
    expect(s.highlights[0].text).toBe("Studied at her desk for about 1.5 hours");
    expect(s.highlights[2].text).toBe("Made tea once");
    expect(s.highlights.find((h) => h.activity === "window")!.minutes).toBe(8); // the event before the absence isn't counted
  });
  it("shows nothing for short absences or when there's too little to say", () => {
    expect(summarizeAway([ev(5, "tea", 10), ev(10, "reading", 20)], T0, T0 + MIN_AWAY_MS - 1, L)).toBeNull();
    expect(summarizeAway([ev(50, "studying", 50)], T0, T0 + 2 * 3_600_000, L)).toBeNull();
  });
  it("formats durations and counts kindly", () => {
    expect(formatDuration(42)).toBe("40 minutes");
    expect(formatDuration(60)).toBe("about an hour");
    expect(formatDuration(500)).toBe("about 8.5 hours");
    expect([1, 2, 5].map(formatTimes)).toEqual(["once", "twice", "5 times"]);
  });
  it("copy never guilt-trips the user about being away", () => {
    const all = [L.title, L.intro, ...Object.values(L.lines)].join(" ").toLowerCase();
    for (const word of ["miss", "lonely", "alone", "waited", "waiting", "where were you", "abandon", "sad", "finally"]) expect(all).not.toContain(word);
  });
});
