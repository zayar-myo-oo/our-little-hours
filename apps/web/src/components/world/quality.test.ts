import { describe, it, expect } from "vitest";
import { detectTier, qualityFor, parseQualityOverride, FrameLimiter } from "./quality";

describe("quality tiers", () => {
  it("picks conservative tiers for phones and save-data", () => {
    expect(detectTier({ dpr: 3, mobile: true, cores: 4, memoryGb: 4 })).toBe("low");
    expect(detectTier({ dpr: 3, mobile: true, cores: 8, memoryGb: 6 })).toBe("medium");
    expect(detectTier({ dpr: 2, mobile: false, cores: 10, memoryGb: 16 })).toBe("high");
    expect(detectTier({ dpr: 2, mobile: false, cores: 10, memoryGb: 16, saveData: true })).toBe("low");
  });
  it("limits pixel ratio, bloom and fps on lower tiers", () => {
    expect(qualityFor("low", 3)).toMatchObject({ pixelRatio: 1, bloom: false, maxFps: 30 });
    expect(qualityFor("medium", 3).pixelRatio).toBe(1.5);
    expect(qualityFor("high", 3).pixelRatio).toBe(2);
  });
  it("reads ?quality= override", () => {
    expect(parseQualityOverride("?quality=low")).toBe("low");
    expect(parseQualityOverride("?quality=ultra")).toBeNull();
  });
  it("frame limiter renders about 30 of 60 frames at 30 fps", () => {
    const f = new FrameLimiter(30);
    let n = 0;
    for (let i = 0; i < 60; i++) if (f.shouldRender(i * (1000 / 60))) n++;
    expect(n).toBeGreaterThanOrEqual(29); expect(n).toBeLessThanOrEqual(31);
  });
});
