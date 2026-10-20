// @vitest-environment jsdom
// Camera clipping against the real study geometry: from every close-up (after the spring-arm pull-in) the
// camera sees the subject with no wall or furniture in between, and is never inside geometry.
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { camPosition, closeupState, distanceFor, pullIn, lerpState, stateFromPose } from "./director";
import { isoCameraPose } from "./iso";
import { buildStudy } from "@/test/buildStudy";
import study from "@content/locations/study.json";
import type { AnchorId, CloseupShot, IsoShot, Vec3 } from "@/world/locations/schema";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; });
const ANCHORS: AnchorId[] = ["desk", "reading", "window", "tea"];

function resolved(statics: THREE.Object3D, s: ReturnType<typeof closeupState>) {
  const target = new THREE.Vector3(...s.target), desired = distanceFor(s.frameH, s.fov);
  const ray = new THREE.Raycaster(target, camPosition(s).sub(target).normalize(), 0.05, desired);
  const hit = ray.intersectObject(statics, true)[0];
  return { target, pos: camPosition(s, pullIn(desired, hit ? hit.distance : null)) };
}

describe("camera never clips through the study", () => {
  const { statics } = buildStudy();
  it.each(ANCHORS.flatMap((a) => [16 / 9, 0.46].map((aspect) => [a, aspect] as const)))("%s close-up (aspect %f) has a clear line of sight", (a, aspect) => {
    const s = closeupState(study.anchors[a].pos as Vec3, study.camera.closeups[a] as CloseupShot, aspect);
    const { target, pos } = resolved(statics, s);
    const back = new THREE.Raycaster(pos, target.clone().sub(pos).normalize(), 0.01, pos.distanceTo(target) - 0.05);
    expect(back.intersectObject(statics, true)).toHaveLength(0);
    expect(pos.distanceTo(target)).toBeGreaterThanOrEqual(0.6);
  });
  it("every point along overview → close-up transitions stays out of the walls", () => {
    const iso = isoCameraPose(study.camera.overview as IsoShot, study.bounds as { min: Vec3; max: Vec3 }, 16 / 9);
    const overview = stateFromPose(iso.position, iso.target, iso.fov);
    for (const a of ANCHORS) {
      const close = closeupState(study.anchors[a].pos as Vec3, study.camera.closeups[a] as CloseupShot, 16 / 9);
      for (let i = 0; i <= 20; i++) {
        const { pos } = resolved(statics, lerpState(overview, close, i / 20));
        expect(pos.z).toBeGreaterThan(-2.45); // back wall
        expect(pos.x).toBeGreaterThan(-2.95); // left wall
        expect(pos.y).toBeGreaterThan(0.2);   // floor
      }
    }
  });
});
