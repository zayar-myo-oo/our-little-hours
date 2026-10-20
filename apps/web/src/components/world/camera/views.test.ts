// @vitest-environment jsdom
// In-room views (cozy, cctv) must show Mio at every anchor, and every close-up camera must be inside the room.
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { buildStudy } from "@/test/buildStudy";
import { camPosition, closeupState } from "./director";
import study from "@content/locations/study.json";
import type { AnchorId, CloseupShot, Vec3 } from "@/world/locations/schema";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; });
const ANCHORS: AnchorId[] = ["desk", "reading", "window", "tea"];
const b = study.bounds;
const headHeight = (a: AnchorId) => (study.anchors[a].pose === "stand" ? 1.35 : 1.05);

describe("in-room views", () => {
  const { statics } = buildStudy();
  for (const view of ["cozy", "cctv"] as const) {
    it.each(ANCHORS)(`${view} view can see her at %s`, (a) => {
      const cam = new THREE.Vector3(...(study.camera.views[view].pos as Vec3));
      const p = study.anchors[a].pos, head = new THREE.Vector3(p[0], headHeight(a), p[2]);
      const dir = head.clone().sub(cam), dist = dir.length();
      const hits = new THREE.Raycaster(cam, dir.normalize(), 0.05, dist - 0.3).intersectObject(statics, true);
      expect(hits.length, `${view} → ${a} blocked`).toBe(0);
    });
  }
});

describe("close-up cameras stay inside the enclosed room", () => {
  it.each(ANCHORS.flatMap((a) => [16 / 9, 0.46].map((r) => [a, r] as const)))("%s at aspect %f", (a, aspect) => {
    const p = camPosition(closeupState(study.anchors[a].pos as Vec3, study.camera.closeups[a] as CloseupShot, aspect));
    expect(p.x).toBeGreaterThan(b.min[0] + 0.05); expect(p.x).toBeLessThan(b.max[0] - 0.05);
    expect(p.z).toBeGreaterThan(b.min[2] + 0.05); expect(p.z).toBeLessThan(b.max[2] - 0.05);
  });
});
