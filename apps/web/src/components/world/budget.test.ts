// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { measureObject, overBudget } from "./budget";
import { makeKit } from "@/components/room3d/kit";
import { paletteFor } from "@/components/room3d/timeOfDay";
import { buildPrefab } from "./prefabs/registry";
import { mergeStatic } from "./mergeStatic";
import type { PrefabId } from "./prefabs/ids";
import study from "@content/locations/study.json";

beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as never; }); // jsdom has no 2D canvas

function buildStudy(lowQuality: boolean) {
  const root = new THREE.Group(), kit = makeKit(root);
  const statics = new THREE.Group(), fg = new THREE.Group();
  for (const p of study.props) {
    const o = buildPrefab(p.prefab as PrefabId, { kit, pal: paletteFor(12), lowQuality }).object;
    o.position.set(...(p.pos as [number, number, number])); o.rotation.y = p.rotY ?? 0;
    (p.layer === "foreground" ? fg : statics).add(o);
  }
  mergeStatic(statics); // exactly what WorldRenderer does
  root.add(statics, fg);
  return root;
}

describe("study scene budgets", () => {
  it.each([false, true])("whole room stays within the manifest budgets (lowQuality=%s)", (low) => {
    const cost = measureObject(buildStudy(low));
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
