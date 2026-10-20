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

describe("placement helpers", () => {
  it("placeSeated without a hand target puts the hips on the seat, no lift", async () => {
    const { placeSeated } = await import("./vrmApply");
    const { root, humanoid, bones } = rig(0.9, 1.0);
    root.position.set(5, 5, 5);
    expect(placeSeated(root, humanoid, 0.45)).toBe(0);
    root.updateMatrixWorld(true);
    expect(bones.hips.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3))).toEqual([0, 0.45, 0]);
  });
  it("placeSeated with a hand target raises the seat for short models", async () => {
    const { placeSeated } = await import("./vrmApply");
    const { root, humanoid, bones } = rig(0.9, 1.04);
    expect(placeSeated(root, humanoid, 0.56, 0.8)).toBeCloseTo(0.1);
    root.updateMatrixWorld(true);
    expect(bones.leftHand.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0.8);
  });
});

describe("skirt controller", () => {
  function skirtRig() {
    const parent = new THREE.Group(), root = new THREE.Group(); parent.add(root);
    const hips = new THREE.Object3D(); hips.name = "J_Bip_C_Hips"; hips.position.y = 0.9; root.add(hips);
    const mk = (name: string, x: number, z: number) => {
      const b = new THREE.Object3D(); b.name = name; b.position.set(x, 0, z); hips.add(b);
      const c = new THREE.Object3D(); c.name = name.replace("0_", "1_"); c.position.set(0, -0.3, 0); b.add(c);
      return { b, c };
    };
    const front = mk("J_Sec_L_SkirtFront0_01", 0, 0.12), back = mk("J_Sec_L_SkirtBack0_01", 0, -0.12), side = mk("J_Sec_L_SkirtSide0_01", 0.14, 0);
    const hair = new THREE.Object3D(); hair.name = "J_Sec_Hair1_01"; hips.add(hair);
    parent.updateMatrixWorld(true);
    return { parent, root, front, back, side, hair };
  }
  const dir = (p: { b: THREE.Object3D; c: THREE.Object3D }) => p.c.getWorldPosition(new THREE.Vector3()).sub(p.b.getWorldPosition(new THREE.Vector3())).normalize();

  it("drapes the front over the lap, sides out/down, back down — and pauses only skirt physics", async () => {
    const { makeSkirtController } = await import("./vrmApply");
    const r = skirtRig();
    const joints = new Set([{ bone: r.front.b }, { bone: r.back.b }, { bone: r.hair }]);
    const springs = { joints, addJoint: vi.fn((j) => joints.add(j)), deleteJoint: vi.fn((j) => joints.delete(j)), reset: vi.fn() };
    const skirt = makeSkirtController(r.root, springs);
    skirt.seat(true);
    expect([...joints].map((j) => j.bone.name)).toEqual(["J_Sec_Hair1_01"]);
    const f = dir(r.front), b = dir(r.back), s = dir(r.side);
    expect(f.z).toBeGreaterThan(0.9);       // forward along the thighs
    expect(f.y).toBeLessThan(0);            // never upward (no flipping)
    expect(b.y).toBeLessThan(-0.9);         // back hangs down onto the seat
    expect(s.x).toBeGreaterThan(0.2); expect(s.y).toBeLessThan(-0.6); // side: outward and down
  });

  it("follows the character's facing", async () => {
    const { makeSkirtController } = await import("./vrmApply");
    const r = skirtRig(); r.parent.rotation.y = Math.PI / 2; r.parent.updateMatrixWorld(true); // facing +X
    makeSkirtController(r.root, null).seat(true);
    expect(dir(r.front).x).toBeGreaterThan(0.9);
  });

  it("standing restores the rest pose and restarts physics", async () => {
    const { makeSkirtController } = await import("./vrmApply");
    const r = skirtRig();
    const joints = new Set([{ bone: r.front.b }]);
    const springs = { joints, addJoint: vi.fn((j) => joints.add(j)), deleteJoint: vi.fn((j) => joints.delete(j)), reset: vi.fn() };
    const skirt = makeSkirtController(r.root, springs);
    skirt.seat(true); skirt.seat(false);
    expect(r.front.b.quaternion.equals(new THREE.Quaternion())).toBe(true);
    expect(joints.size).toBe(1);
    expect(springs.reset).toHaveBeenCalledOnce();
  });
});
