import { describe, it, expect } from "vitest";
import { resolveFlags, DEFAULT_FLAGS } from "./featureFlags";

describe("feature flags", () => {
  it("living world is off by default", () => {
    expect(DEFAULT_FLAGS.livingWorld).toBe(false);
    expect(resolveFlags({}).livingWorld).toBe(false);
  });
  it("applies env < stored < URL precedence", () => {
    expect(resolveFlags({ env: { livingWorld: "1" } }).livingWorld).toBe(true);
    expect(resolveFlags({ env: { livingWorld: "1" }, stored: '{"livingWorld":false}' }).livingWorld).toBe(false);
    expect(resolveFlags({ stored: '{"livingWorld":false}', search: "?ff=livingWorld" }).livingWorld).toBe(true);
    expect(resolveFlags({ env: { livingWorld: "true" }, search: "?ff=-livingWorld" }).livingWorld).toBe(false);
  });
  it("ignores unknown flags and malformed overrides", () => {
    expect(resolveFlags({ stored: "{bad", search: "?ff=nope,-alsoNope" })).toEqual(DEFAULT_FLAGS);
  });
});
