import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { findOccluders, makeFadeable, updateFades } from "./occlusion";

function scene() {
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
  const shared = new THREE.MeshBasicMaterial();
  const blocker = new THREE.Group(); blocker.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared)); blocker.position.set(0, 0, 5);
  const aside = new THREE.Group(); aside.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared)); aside.position.set(4, 0, 5);
  const behind = new THREE.Group(); behind.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared)); behind.position.set(0, 0, -3);
  for (const g of [blocker, aside, behind]) g.updateMatrixWorld(true);
  return { cam, blocker, aside, behind, shared };
}

describe("foreground occlusion", () => {
  it("only objects between the camera and the character count", () => {
    const { cam, blocker, aside, behind } = scene();
    const hit = findOccluders(cam, [new THREE.Vector3(0, 0, 0)], [blocker, aside, behind]);
    expect([...hit]).toEqual([blocker]);
  });
  it("fades with private materials, so shared materials are untouched", () => {
    const { blocker, aside, shared } = scene();
    makeFadeable(blocker); makeFadeable(aside);
    updateFades([blocker, aside], new Set([blocker]), 0, true);
    const mat = (blocker.children[0] as THREE.Mesh).material as THREE.Material;
    expect(mat.opacity).toBeCloseTo(0.25);
    expect(mat).not.toBe(shared);
    expect(shared.opacity).toBe(1);
    expect(((aside.children[0] as THREE.Mesh).material as THREE.Material).opacity).toBe(1);
    updateFades([blocker], new Set(), 0.05, false); // eases back, not instantly
    expect(mat.opacity).toBeGreaterThan(0.25);
    expect(mat.opacity).toBeLessThan(1);
  });
});

describe("close-up foreground fading", () => {
  it("fades props nearer to the camera than the subject, even off the line of sight", async () => {
    const { nearerThanSubject } = await import("./occlusion");
    const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 0, 10); cam.updateMatrixWorld(true);
    const nearSide = new THREE.Group(); nearSide.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))); nearSide.position.set(3, 0, 8);
    const farSide = new THREE.Group(); farSide.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))); farSide.position.set(3, 0, -4);
    for (const g of [nearSide, farSide]) g.updateMatrixWorld(true);
    expect([...nearerThanSubject(cam, new THREE.Vector3(0, 0, 0), [nearSide, farSide])]).toEqual([nearSide]);
  });
});
