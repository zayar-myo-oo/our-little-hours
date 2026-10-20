// three.js-side VRM setup steps, extracted from room3d/scene3d.ts (behaviour unchanged). They only touch
// plain Object3D/material APIs, so they are tested in Node with hand-built hierarchies.
import * as THREE from "three";
import { seatLift, SEAT_TOP_Y, classifySkirtBone, skirtDrapeDirection, type BoneRotation } from "./vrmPose";

export interface HumanoidLike { getNormalizedBoneNode(name: string): THREE.Object3D | null; update?(): void; resetNormalizedPose?(): void }

/** Apply bone rotations (from vrmPose) to the normalized humanoid, then sync the raw bones. */
export function applyPose(humanoid: HumanoidLike, pose: readonly BoneRotation[]) {
  for (const [bone, x, y, z] of pose) humanoid.getNormalizedBoneNode(bone)?.rotation.set(x, y, z);
  humanoid.update?.();
}

/** Position the posed model on the chair so its hands reach the keyboard. Returns the extra seat lift. */
export function placeOnSeat(root: THREE.Object3D, humanoid: HumanoidLike, z: number): number {
  root.updateMatrixWorld(true);
  const hipY = humanoid.getNormalizedBoneNode("hips")?.getWorldPosition(new THREE.Vector3()).y ?? 0.9;
  const handY = humanoid.getNormalizedBoneNode("leftHand")?.getWorldPosition(new THREE.Vector3()).y ?? hipY;
  const lift = seatLift(hipY, handY);
  root.position.set(0, SEAT_TOP_Y + lift - hipY, z);
  return lift;
}

/**
 * Seat a posed model on a seat of height `seatTop` (root at x = z = 0; the caller moves a parent to the anchor).
 * With `handTargetY` the seat is raised so the hands reach that height (desk typing); never lowered.
 */
export function placeSeated(root: THREE.Object3D, humanoid: HumanoidLike, seatTop: number, handTargetY?: number): number {
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const hipY = humanoid.getNormalizedBoneNode("hips")?.getWorldPosition(new THREE.Vector3()).y ?? 0.9;
  const handY = humanoid.getNormalizedBoneNode("leftHand")?.getWorldPosition(new THREE.Vector3()).y ?? hipY;
  const lift = handTargetY === undefined ? 0 : seatLift(hipY, handY, seatTop, handTargetY);
  root.position.y = seatTop + lift - hipY;
  return lift;
}

/** Stand on the floor (VRM origin is at the feet). */
export function placeStanding(root: THREE.Object3D) { root.position.set(0, 0, 0); }

type Tintable = THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color };

/** Multiply base and shade colours of every material under root by k (MToon brightness match). Call once per load. */
export function dimMaterials(root: THREE.Object3D, k: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as Tintable | Tintable[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) { mat.color?.multiplyScalar(k); mat.shadeColorFactor?.multiplyScalar(k); }
  });
}

interface SpringJointLike { bone: THREE.Object3D }
export interface SpringManagerLike { joints: Set<SpringJointLike>; addJoint(j: SpringJointLike): void; deleteJoint(j: SpringJointLike): void; reset(): void }

/** Rotate `bone` (keeping its parent) so that the direction to `child` points along `dirWorld`. */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, dirWorld: THREE.Vector3) {
  const p = bone.getWorldPosition(new THREE.Vector3()), c = child.getWorldPosition(new THREE.Vector3());
  const cur = c.sub(p).normalize();
  if (cur.lengthSq() < 1e-8) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(cur, dirWorld.clone().normalize());
  const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
  const parentWorld = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  bone.quaternion.copy(parentWorld.invert().multiply(world));
  bone.updateMatrixWorld(true);
}

/**
 * Skirt handling for seated poses. Spring physics pushes skirts up against the leg colliders when the thighs
 * are horizontal (the "flipped skirt"). While seated, skirt joints leave the physics and each panel is AIMED
 * by direction (front over the lap, sides out and down, back down): this works whatever each bone's local axes
 * are. Standing restores the rest pose and restarts the physics. Call seat(true) after the body is posed/placed.
 */
export function makeSkirtController(root: THREE.Object3D, springs: SpringManagerLike | null | undefined) {
  type Entry = { bone: THREE.Object3D; rest: THREE.Quaternion; segment: number; child: THREE.Object3D | null };
  const bones: Entry[] = [];
  root.traverse((o) => {
    const c = classifySkirtBone(o.name);
    if (c) bones.push({ bone: o, rest: o.quaternion.clone(), segment: c.segment, child: o.children.find((k) => /Skirt/i.test(k.name)) ?? null });
  });
  const boneSet = new Set(bones.map((b) => b.bone));
  const joints = springs ? [...springs.joints].filter((j) => boneSet.has(j.bone)) : [];
  let seated = false;
  const restore = () => { for (const b of bones) b.bone.quaternion.copy(b.rest); root.updateMatrixWorld(true); };
  return {
    count: bones.length,
    seat(on: boolean) {
      if (bones.length === 0) return;
      if (on !== seated) for (const j of joints) if (on) springs!.deleteJoint(j); else springs!.addJoint(j);
      const was = seated; seated = on;
      restore();
      if (!on) { if (was) springs?.reset(); return; }
      // the character's frame in world space (forward = +Z of the model's parent, i.e. the anchor facing)
      const frame = (root.parent ?? root).getWorldQuaternion(new THREE.Quaternion());
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(frame), right = new THREE.Vector3(1, 0, 0).applyQuaternion(frame);
      const hips = root.getObjectByName("J_Bip_C_Hips") ?? root;
      const hp = hips.getWorldPosition(new THREE.Vector3());
      for (const seg of [0, 2]) for (const b of bones) {
        if (b.segment !== seg || !b.child) continue;
        const off = b.bone.getWorldPosition(new THREE.Vector3()).sub(hp); off.y = 0;
        const h = off.length() > 1e-4 ? off.normalize() : fwd.clone();
        const frontness = h.dot(fwd), side = h.dot(right);
        if (seg === 2 && frontness < 0.35) continue; // only front hems drop over the knees
        const [x, y, z] = skirtDrapeDirection(frontness, [side, frontness], seg === 2);
        aimBone(b.bone, b.child, right.clone().multiplyScalar(x).add(new THREE.Vector3(0, y, 0)).addScaledVector(fwd, z));
      }
    },
  };
}
