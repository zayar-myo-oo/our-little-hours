import { describe, it, expect } from "vitest";
import { seatedTypingPose, mirrorSign, seatLift, mtoonDimFactor } from "./vrmPose";
import { paletteFor } from "@/components/room3d/timeOfDay";

describe("vrm pose math", () => {
  it("mirrors X/Z rotations for VRM 0.x only", () => {
    expect(mirrorSign("0")).toBe(-1);
    expect(mirrorSign("1")).toBe(1);
    expect(mirrorSign(undefined)).toBe(1);
    const v1 = seatedTypingPose("1"), v0 = seatedTypingPose("0");
    expect(v1).toHaveLength(12);
    v1.forEach(([b, x, y, z], i) => expect(v0[i]).toEqual([b, -x, y, -z]));
  });
  it("keeps the exact angles used before extraction", () => {
    const pose = Object.fromEntries(seatedTypingPose("1").map(([b, ...r]) => [b, r]));
    expect(pose.leftUpperLeg).toEqual([-Math.PI / 2, 0, 0]);
    expect(pose.leftUpperArm).toEqual([0, -0.9, -0.85]);
    expect(pose.rightLowerArm).toEqual([0, 0.9, -0.8]);
    expect(pose.spine).toEqual([0.12, 0, 0]);
  });
  it("seat lift raises short models only", () => {
    expect(seatLift(0.9, 1.04)).toBeCloseTo(0.1);   // hands below the desk → lift
    expect(seatLift(0.9, 1.2)).toBe(0);             // hands already high → no lift
  });
  it("dims MToon by day but not at night", () => {
    const day = paletteFor(13), night = paletteFor(2);
    expect(mtoonDimFactor(day.ambient, day.sunIntensity)).toBeCloseTo(0.488, 2);
    expect(mtoonDimFactor(night.ambient, night.sunIntensity)).toBe(1);
    expect(mtoonDimFactor(100, 100)).toBe(0.45);
  });
});
