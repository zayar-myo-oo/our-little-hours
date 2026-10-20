import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { mergeStatic } from "./mergeStatic";
import { measureObject } from "./budget";

describe("mergeStatic", () => {
  it("one mesh per material, same triangles and bounds, lights kept", () => {
    const root = new THREE.Group(); root.position.set(3, 0, 0);
    const red = new THREE.MeshBasicMaterial({ color: 0xff0000 }), blue = new THREE.MeshBasicMaterial();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), red); a.position.set(1, 0, 0);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5), red); b.position.set(-1, 2, 0); b.rotation.y = 1;
    const outline = new THREE.Mesh(a.geometry, blue); outline.scale.setScalar(1.05); a.add(outline);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blue);
    const light = new THREE.PointLight(); const g = new THREE.Group(); g.add(b, light); g.position.z = 2;
    root.add(a, g, c);
    root.updateMatrixWorld(true);
    const before = measureObject(root), box = new THREE.Box3().setFromObject(root, true);
    expect(mergeStatic(root)).toEqual({ before: 4, after: 2 });
    const after = measureObject(root);
    expect(after.drawCalls).toBe(2);
    expect(after.triangles).toBe(before.triangles);
    const box2 = new THREE.Box3().setFromObject(root, true);
    expect(box2.min.distanceTo(box.min)).toBeLessThan(1e-4);
    expect(box2.max.distanceTo(box.max)).toBeLessThan(1e-4);
    let lights = 0; root.traverse((o) => { if ((o as THREE.Light).isLight) lights++; });
    expect(lights).toBe(1);
  });
  it("skips meshes marked noMerge and instanced meshes", () => {
    const root = new THREE.Group(), mat = new THREE.MeshBasicMaterial();
    const keep = new THREE.Mesh(new THREE.BoxGeometry(), mat); keep.userData.noMerge = true;
    root.add(keep, new THREE.InstancedMesh(new THREE.BoxGeometry(), mat, 3), new THREE.Mesh(new THREE.BoxGeometry(), mat));
    expect(mergeStatic(root)).toEqual({ before: 1, after: 1 });
    expect(root.children).toContain(keep);
  });
});
