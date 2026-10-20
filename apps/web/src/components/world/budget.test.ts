// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { measureObject, overBudget } from "./budget";
import { buildStudy } from "@/test/buildStudy";
import study from "@content/locations/study.json";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; }); // jsdom has no 2D canvas

describe("study scene budgets", () => {
  it.each([false, true])("whole room stays within the manifest budgets (lowQuality=%s)", (low) => {
    const cost = measureObject(buildStudy(low).root);
    expect(overBudget(cost, study.budgets)).toEqual([]);
    expect(cost.meshes).toBeGreaterThan(50); // sanity: the room really was built
  });
  it("counts instanced meshes once per draw and triangles per instance", () => {
    const geo = new THREE.BoxGeometry(); // 12 triangles
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 10);
    const g = new THREE.Group(); g.add(inst, new THREE.Mesh(geo, [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]));
    expect(measureObject(g)).toMatchObject({ drawCalls: 3, triangles: 12 * 10 + 12, meshes: 2 });
  });
  it("reports every exceeded limit", () => {
    expect(overBudget({ drawCalls: 300, triangles: 10, textureMB: 20 }, study.budgets)).toHaveLength(2);
  });
});
