import { describe, it, expect } from "vitest";
import { mockReply } from "./mockProvider";
import type { ChatContext } from "./types";
const ctx: ChatContext = { availability: "AVAILABLE", activity: "Studying", tasksOpen: 2, focusSessions: 0, hour: 15 };
describe("mock chat", () => {
  it("respects schedule state", () => {
    expect(mockReply("hi", { ...ctx, availability: "SLEEPING" })).toMatch(/dozed off/);
    expect(mockReply("hi", { ...ctx, availability: "BUSY", activity: "Lunch break" })).toMatch(/lunch break/);
  });
  it("uses context in replies", () => { expect(mockReply("what's on my todo list", ctx)).toMatch(/2 open tasks/); });
  it("always replies", () => { expect(mockReply("qwerty", ctx).length).toBeGreaterThan(0); });
});
