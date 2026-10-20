// @vitest-environment jsdom
// Walking routes must not pass through furniture or walls (checked against the real built study).
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { buildStudy } from "@/test/buildStudy";
import study from "@content/locations/study.json";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; });

const anchors = study.anchors as Record<string, { pos: number[]; approach?: number }>;
const pos = (id: string) => (study.waypoints.nodes as Record<string, number[]>)[id] ?? anchors[id].pos;

describe("walking routes are clear", () => {
  const { statics } = buildStudy();
  it.each(study.waypoints.edges.map((e) => [e[0], e[1]]))("%s ↔ %s", (a, b) => {
    for (const h of [0.3, 1.0]) {
      const p = new THREE.Vector3(pos(a)[0], h, pos(a)[2]), q = new THREE.Vector3(pos(b)[0], h, pos(b)[2]);
      const len = p.distanceTo(q), dir = q.clone().sub(p).normalize();
      // the last `approach` metres into an anchor are sitting down onto furniture, not walking
      const skipStart = a in anchors ? anchors[a].approach ?? 0.35 : 0, skipEnd = b in anchors ? anchors[b].approach ?? 0.35 : 0;
      const ray = new THREE.Raycaster(p.clone().addScaledVector(dir, skipStart), dir, 0, Math.max(0, len - skipStart - skipEnd));
      const hits = ray.intersectObject(statics, true);
      expect(hits.map((x) => x.object.name), `${a}→${b} at ${h} m`).toEqual([]);
    }
  });
});
