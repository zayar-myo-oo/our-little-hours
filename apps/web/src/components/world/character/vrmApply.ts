// three.js-side VRM setup steps, extracted from room3d/scene3d.ts (behaviour unchanged). They only touch
// plain Object3D/material APIs, so they are tested in Node with hand-built hierarchies.
import * as THREE from "three";
import { seatLift, SEAT_TOP_Y, type BoneRotation } from "./vrmPose";

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
