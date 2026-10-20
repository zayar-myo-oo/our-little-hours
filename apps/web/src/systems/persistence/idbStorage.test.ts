import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { idbStorage } from "./idbStorage";
describe("idb storage", () => {
  it("round-trips values", async () => {
    await idbStorage.setItem("k", "v");
    expect(await idbStorage.getItem("k")).toBe("v");
    await idbStorage.removeItem("k");
    expect(await idbStorage.getItem("k")).toBeNull();
  });
});
