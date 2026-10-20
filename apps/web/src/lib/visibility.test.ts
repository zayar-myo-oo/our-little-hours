import { describe, it, expect } from "vitest";
import { pauseWhenHidden } from "./visibility";

function fakeDoc(initial: DocumentVisibilityState = "visible") {
  const target = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
  target.visibilityState = initial;
  const set = (v: DocumentVisibilityState) => { target.visibilityState = v; target.dispatchEvent(new Event("visibilitychange")); };
  return { doc: target as unknown as Document, set };
}

describe("pauseWhenHidden", () => {
  it("pauses on hidden and resumes on visible, once each", () => {
    const calls: string[] = [];
    const { doc, set } = fakeDoc();
    const stop = pauseWhenHidden({ pause: () => calls.push("pause"), resume: () => calls.push("resume") }, doc);
    set("hidden"); set("hidden"); set("visible"); set("visible");
    expect(calls).toEqual(["pause", "resume"]);
    stop(); set("hidden");
    expect(calls).toEqual(["pause", "resume"]);
  });
  it("pauses immediately if the page starts hidden", () => {
    const calls: string[] = [];
    pauseWhenHidden({ pause: () => calls.push("pause"), resume: () => calls.push("resume") }, fakeDoc("hidden").doc);
    expect(calls).toEqual(["pause"]);
  });
  it("does nothing without a document (SSR)", () => {
    expect(() => pauseWhenHidden({ pause() {}, resume() {} }, undefined)()).not.toThrow();
  });
});
