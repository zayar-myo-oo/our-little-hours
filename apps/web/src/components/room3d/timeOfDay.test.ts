import { describe, it, expect } from "vitest";
import { phaseFor, paletteFor } from "./timeOfDay";
describe("time of day", () => {
  it("maps hours to phases", () => {
    expect([3, 6, 12, 18, 22].map(phaseFor)).toEqual(["night", "morning", "day", "sunset", "night"]);
  });
  it("lamp is brighter at night than day", () => { expect(paletteFor(23).lamp).toBeGreaterThan(paletteFor(12).lamp); });
});
describe("palette", () => {
  it("only shows sun rays when the sun is up, and glows more at night", () => {
    expect(paletteFor(12).rays).toBe(true);
    expect(paletteFor(2).rays).toBe(false);
    expect(paletteFor(2).bloom).toBeGreaterThan(paletteFor(12).bloom);
  });
});
