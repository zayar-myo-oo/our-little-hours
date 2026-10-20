import { describe, it, expect } from "vitest";
import { currentBlock, nextChange, DEFAULT_SCHEDULE } from "./schedule";
const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);
describe("schedule", () => {
  it("covers every minute of the day contiguously", () => {
    let t = 0;
    for (const b of DEFAULT_SCHEDULE) { expect(b.start).toBe(t); t = b.end; }
    expect(t).toBe(24 * 60);
  });
  it("returns correct states", () => {
    expect(currentBlock(at(3)).state).toBe("SLEEPING");
    expect(currentBlock(at(10)).state).toBe("AVAILABLE");
    expect(currentBlock(at(12, 30)).state).toBe("BUSY");
    expect(currentBlock(at(23, 45)).state).toBe("SLEEPING");
  });
  it("finds next state change", () => {
    expect(nextChange(at(10)).state).toBe("BUSY");
    expect(nextChange(at(2)).start).toBe(7 * 60);
  });
});
