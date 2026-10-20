import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { applyPose, placeOnSeat, dimMaterials, type HumanoidLike } from "./vrmApply";
import { seatedTypingPose } from "./vrmPose";

/** Minimal humanoid: root → hips (y=hipY) → leftHand (y=handY above hips, in hips space). */
function rig(hipY: number, handY: number) {
  const root = new THREE.Group(), hips = new THREE.Object3D(), hand = new THREE.Object3D();
  hips.position.y = hipY; hand.position.y = handY - hipY;
  root.add(hips); hips.add(hand);
  const bones: Record<string, THREE.Object3D> = { hips, leftHand: hand, leftUpperArm: new THREE.Object3D() };
  const humanoid: HumanoidLike = { getNormalizedBoneNode: (n) => bones[n] ?? null, update: vi.fn() };
  return { root, humanoid, bones };
}

describe("vrm apply helpers", () => {
  it("applyPose sets rotations on existing bones, skips missing ones, then syncs", () => {
    const { humanoid, bones } = rig(0.9, 1.2);
    applyPose(humanoid, seatedTypingPose("1"));
    expect(bones.leftUpperArm.rotation.toArray().slice(0, 3)).toEqual([0, -0.9, -0.85]);
    expect(humanoid.update).toHaveBeenCalledOnce();
  });

  it("placeOnSeat lifts a short model so hands reach the keyboard", () => {
    const { root, humanoid, bones } = rig(0.9, 1.04);
    const lift = placeOnSeat(root, humanoid, -0.62);
    expect(lift).toBeCloseTo(0.1);
    expect(root.position.z).toBe(-0.62);
    root.updateMatrixWorld(true);
    expect(bones.leftHand.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0.8); // keyboard height
  });

  it("placeOnSeat does not lift a model whose hands already reach", () => {
    const { root, humanoid, bones } = rig(0.9, 1.2);
    expect(placeOnSeat(root, humanoid, 0)).toBe(0);
    root.updateMatrixWorld(true);
    expect(bones.hips.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0.56); // seat top
  });

  it("dimMaterials scales base and shade colours, including material arrays", () => {
    const root = new THREE.Group();
    const a = new THREE.MeshBasicMaterial({ color: 0xffffff }) as THREE.MeshBasicMaterial & { shadeColorFactor?: THREE.Color };
    a.shadeColorFactor = new THREE.Color(1, 1, 1);
    const b = new THREE.MeshBasicMaterial({ color: 0x808080 });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), [b, new THREE.MeshBasicMaterial()]));
    dimMaterials(root, 0.5);
    expect(a.color.r).toBeCloseTo(0.5);
    expect(a.shadeColorFactor.g).toBeCloseTo(0.5);
    expect(b.color.r).toBeCloseTo(new THREE.Color(0x808080).r * 0.5);
  });
});
