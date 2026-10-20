import { describe, it, expect } from "vitest";
import { parseManifest, resolveModelUrl, thumbUrl } from "./models";

describe("character models", () => {
  it("keeps only valid, unique .vrm entries", () => {
    const list = parseManifest({ characters: [
      { id: "a", name: "A", file: "a.vrm" }, { id: "a", name: "dup", file: "x.vrm" },
      { id: "b", name: "B", file: "b.vroid" }, { id: "placeholder", name: "P", file: "p.vrm" }, null, { name: "no id", file: "c.vrm" },
    ] });
    expect(list.map((m) => m.id)).toEqual(["a"]);
    expect(parseManifest(null)).toEqual([]);
  });
  it("resolves only available models, else placeholder (null)", () => {
    const list = [{ id: "a", name: "A", file: "girl one.vrm", available: true }, { id: "b", name: "B", file: "b.vrm", available: false }];
    expect(resolveModelUrl(list, "a")).toBe("/models/girl%20one.vrm");
    expect(resolveModelUrl(list, "b")).toBeNull();
    expect(resolveModelUrl(list, "missing")).toBeNull();
  });
  it("builds thumbnail urls", () => {
    expect(thumbUrl({ id: "a", name: "A", file: "a.vrm", thumbnail: "thumbs/a b.jpg" })).toBe("/models/thumbs/a%20b.jpg");
  });
});
