import { describe, it, expect } from "vitest";
import * as T from "./tasks";
describe("tasks", () => {
  it("adds, toggles, edits, removes, clears", () => {
    let t = T.addTask([], "  Read chapter 3  ");
    t = T.addTask(t, "   ");
    expect(t).toHaveLength(1);
    expect(t[0].title).toBe("Read chapter 3");
    t = T.toggleTask(t, t[0].id);
    expect(T.progress(t)).toEqual({ done: 1, total: 1 });
    t = T.editTask(t, t[0].id, "Read chapter 4");
    expect(t[0].title).toBe("Read chapter 4");
    t = T.addTask(t, "Laundry");
    expect(T.clearDone(t).map((x) => x.title)).toEqual(["Laundry"]);
    expect(T.removeTask(t, t[1].id)).toHaveLength(1);
  });
});
