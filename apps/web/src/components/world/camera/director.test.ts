import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  CameraDirector, camPosition, closeupState, distanceFor, lerpState, angleDelta, transitionSeconds, pullIn,
  responsiveFrameH, stateFromPose, type CamState,
} from "./director";
import { isoCameraPose } from "./iso";
import study from "@content/locations/study.json";
import type { AnchorId, CloseupShot, IsoShot, Vec3 } from "@/world/locations/schema";

const ANCHORS: AnchorId[] = ["desk", "reading", "window", "tea"];
const bounds = study.bounds as { min: Vec3; max: Vec3 };
function shots(aspect = 16 / 9) {
  const iso = isoCameraPose(study.camera.overview as IsoShot, bounds, aspect);
  const overview = stateFromPose(iso.position, iso.target, iso.fov);
  const closeups = Object.fromEntries(ANCHORS.map((a) => [a, closeupState(study.anchors[a].pos as Vec3, study.camera.closeups[a] as CloseupShot, aspect)])) as Record<AnchorId, CamState>;
  const holds = Object.fromEntries(ANCHORS.map((a) => [a, study.camera.closeups[a].hold])) as Record<AnchorId, number>;
  return { overview, closeups, holds, iso };
}

/** Projected screen height (NDC) of a short stick at the target, lying in the plane facing the camera (the focus plane). */
function subjectSize(s: CamState) {
  const cam = new THREE.PerspectiveCamera(s.fov, 1, 0.01, 1000);
  cam.position.copy(camPosition(s)); cam.lookAt(new THREE.Vector3(...s.target)); cam.updateMatrixWorld(true);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion).multiplyScalar(0.1); // camera-up, in the focus plane
  const a = new THREE.Vector3(...s.target).project(cam), b = new THREE.Vector3(...s.target).add(up).project(cam);
  return Math.abs(b.y - a.y);
}

describe("camera math", () => {
  it("overview state round-trips the iso pose exactly", () => {
    const { overview, iso } = shots();
    expect(camPosition(overview).distanceTo(iso.position)).toBeLessThan(1e-6);
  });

  it("is a TRUE dolly zoom: changing fov at constant frameH keeps the subject size, and moves the camera", () => {
    const a: CamState = { target: [0, 1, 0], yaw: 0.5, pitch: 0.3, fov: 20, frameH: 2 };
    const b = { ...a, fov: 40 };
    expect(subjectSize(b)).toBeCloseTo(subjectSize(a), 3);
    expect(distanceFor(b.frameH, b.fov)).toBeLessThan(distanceFor(a.frameH, a.fov) * 0.6);
    // a plain zoom (fov change at fixed distance) would change the size; prove the test can tell the difference
    const plainZoom: CamState = { ...a, fov: 40, frameH: 2 * distanceFor(2, 20) * Math.tan((40 * Math.PI) / 360) };
    expect(subjectSize(plainZoom)).toBeLessThan(subjectSize(a) * 0.6);
  });

  it("subject size changes smoothly and monotonically through an overview → close-up transition", () => {
    const { overview, closeups } = shots();
    const sizes = Array.from({ length: 21 }, (_, i) => subjectSize(lerpState(overview, closeups.desk, i / 20)));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      expect(sizes[i] / sizes[i - 1]).toBeLessThan(1.4); // no sudden jumps between steps
    }
  });

  it("yaw takes the shortest way round", () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(lerpState({ target: [0, 0, 0], yaw: 3, pitch: 0, fov: 30, frameH: 1 }, { target: [0, 0, 0], yaw: -3, pitch: 0, fov: 30, frameH: 1 }, 0.5).yaw).toBeCloseTo(Math.PI, 1);
  });

  it("transitions are gentle: between 0.9 s and 2.4 s", () => {
    const { overview, closeups } = shots();
    for (const a of ANCHORS) {
      const t = transitionSeconds(overview, closeups[a]);
      expect(t).toBeGreaterThanOrEqual(0.9); expect(t).toBeLessThanOrEqual(2.4);
    }
  });

  it("portrait close-ups keep at least 1 m visible across", () => {
    expect(responsiveFrameH(1.1, 16 / 9)).toBe(1.1);
    expect(responsiveFrameH(1.1, 0.46) * 0.46).toBeCloseTo(1.0);
  });

  it("pullIn keeps the camera in front of obstacles", () => {
    expect(pullIn(5, null)).toBe(5);
    expect(pullIn(5, 7)).toBe(5);
    expect(pullIn(5, 2)).toBeCloseTo(1.85);
    expect(pullIn(5, 0.3)).toBe(0.6);
  });
});

describe("close-up shots stay inside the open sides of the diorama", () => {
  it.each(ANCHORS)("%s camera is in front of the back wall and right of the left wall, above the floor", (a) => {
    const p = camPosition(shots().closeups[a]);
    expect(p.z).toBeGreaterThan(-2.45);
    expect(p.x).toBeGreaterThan(-2.95);
    expect(p.y).toBeGreaterThan(0.3);
  });
});

describe("CameraDirector", () => {
  const make = () => { const s = shots(); return { d: new CameraDirector({ overview: s.overview, closeups: s.closeups, holds: s.holds }), s }; };

  it("starts in overview and transitions to a close-up, ending exactly on it", () => {
    const { d, s } = make();
    expect(d.update(0)).toEqual(s.overview);
    d.focus("desk", 1000);
    const mid = d.update(1500);
    expect(mid).not.toEqual(s.overview); expect(mid).not.toEqual(s.closeups.desk);
    expect(d.update(1000 + 2500)).toEqual(s.closeups.desk);
    expect(d.currentShot).toBe("desk");
  });

  it("interrupting a transition continues from the in-between view (no jump)", () => {
    const { d, s } = make();
    d.focus("desk", 0);
    const before = d.update(400);
    d.focus("tea", 400);
    const after = d.update(400);
    expect(camPosition(after).distanceTo(camPosition(before))).toBeLessThan(1e-9);
    expect(d.update(400 + 2500)).toEqual(s.closeups.tea);
  });

  it("reduced motion cuts instead of animating", () => {
    const { d, s } = make();
    d.reducedMotion = true;
    d.focus("window", 0);
    expect(d.update(0)).toEqual(s.closeups.window);
  });

  it("manual choice wins over automatic switching for a while", () => {
    const { d } = make();
    d.focus("reading", 0, "manual");
    expect(d.focus("desk", 1000, "auto")).toBe(false);
    expect(d.currentShot).toBe("reading");
    expect(d.focus("desk", 46_000, "auto")).toBe(true);
  });

  it("auto close-ups return to the overview after their hold time; auto off disables them", () => {
    const { d, s } = make();
    d.focus("desk", 0, "auto");
    d.update(5000);
    expect(d.currentShot).toBe("desk");
    d.update(s.holds.desk * 1000 + 1);
    expect(d.currentShot).toBe("overview");
    d.auto = false;
    expect(d.focus("tea", 99_000, "auto")).toBe(false);
  });
});
