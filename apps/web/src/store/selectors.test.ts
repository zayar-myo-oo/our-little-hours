import { describe, it, expect } from "vitest";
import { selectChat, selectOpenTaskCount, selectTasks } from "./selectors";

const state = {
  tasks: [{ id: "a", title: "x", done: false, createdAt: 0 }, { id: "b", title: "y", done: true, createdAt: 0 }],
  taskAction: () => {}, chat: [], pushChat: () => {}, clearChat: () => {},
  settings: { chatProvider: "mock", ollamaUrl: "u", ollamaModel: "m", musicVolume: 1 },
} as never;

describe("selectors", () => {
  it("pick only what a panel needs", () => {
    expect(Object.keys(selectTasks(state))).toEqual(["tasks", "taskAction"]);
    expect(selectChat(state)).not.toHaveProperty("settings");
    expect(selectOpenTaskCount(state)).toBe(1);
  });
});
