import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { isoCameraPose, boxCorners, projectForTest, responsiveShot, isoDirection } from "./iso";
import study from "@content/locations/study.json";
import type { IsoShot, Vec3 } from "@/world/locations/schema";

const shot = study.camera.overview as IsoShot;
const bounds = study.bounds as { min: Vec3; max: Vec3 };

describe("iso overview camera", () => {
  it.each([16 / 9, 4 / 3, 1, 0.46])("fits the room inside the viewport at aspect %f", (aspect) => {
    const pose = isoCameraPose(shot, bounds, aspect);
    const { cropX } = responsiveShot(shot, aspect);
    const cx = (bounds.min[0] + bounds.max[0]) / 2, hx = 3 * cropX, hz = 2.5 * cropX;
    const pts = projectForTest(pose, aspect, boxCorners([cx - hx, 0, -hz], [cx + hx, 2.8, hz]));
    for (const p of pts) { expect(Math.abs(p.x)).toBeLessThanOrEqual(1); expect(Math.abs(p.y)).toBeLessThanOrEqual(1); }
    // tight: something touches the margin, so the room isn't tiny
    expect(Math.max(...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))).toBeGreaterThan(0.85);
  });
  it("looks down from the front-right diagonal, far away with a narrow lens", () => {
    const pose = isoCameraPose(shot, bounds, 16 / 9);
    expect(pose.position.x).toBeGreaterThan(0);
    expect(pose.position.z).toBeGreaterThan(0);
    expect(pose.position.y).toBeGreaterThan(5);
    expect(pose.position.distanceTo(pose.target)).toBeGreaterThan(15);
    expect(pose.fov).toBeLessThanOrEqual(25);
  });
  it("direction vector is unit length", () => {
    expect(isoDirection(0.785, 0.55).length()).toBeCloseTo(1);
    expect(new THREE.Vector3().length()).toBe(0);
  });
  it("portrait framing widens the lens and crops the sides", () => {
    expect(responsiveShot(shot, 0.46)).toEqual({ fov: shot.fov * 1.45, cropX: 0.62 });
  });
});
