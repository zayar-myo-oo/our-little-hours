// Isometric-style overview camera: a narrow-FOV perspective camera far away along a fixed yaw/pitch,
// distance solved so the room's bounds fit the viewport (responsive to aspect ratio).
import * as THREE from "three";
import type { IsoShot, Vec3 } from "@/world/locations/schema";

export interface CameraPose { position: THREE.Vector3; target: THREE.Vector3; fov: number }

/** Unit vector from the target towards the camera. yaw 0 = camera on +Z; pitch = elevation angle. */
export const isoDirection = (yaw: number, pitch: number) =>
  new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

export function boxCorners(min: Vec3, max: Vec3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/** Portrait screens can't show the whole room at a readable size: widen the FOV a little and crop the sides. */
export function responsiveShot(shot: IsoShot, aspect: number): { fov: number; cropX: number } {
  if (aspect >= 1.1) return { fov: shot.fov, cropX: 1 };
  if (aspect >= 0.8) return { fov: shot.fov * 1.15, cropX: 0.9 };
  return { fov: Math.min(40, shot.fov * 1.45), cropX: 0.62 };
}

function project(pose: CameraPose, aspect: number, pts: THREE.Vector3[]) {
  const cam = new THREE.PerspectiveCamera(pose.fov, aspect, 0.05, 500);
  cam.position.copy(pose.position); cam.lookAt(pose.target); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  return pts.map((p) => p.clone().project(cam));
}

/** Distance at which every bound corner lands inside the viewport minus `margin` (NDC units). */
export function fitIsoDistance(shot: IsoShot, bounds: { min: Vec3; max: Vec3 }, aspect: number): number {
  const { fov, cropX } = responsiveShot(shot, aspect);
  const cx = (bounds.min[0] + bounds.max[0]) / 2, hx = ((bounds.max[0] - bounds.min[0]) / 2) * cropX;
  const cz = (bounds.min[2] + bounds.max[2]) / 2, hz = ((bounds.max[2] - bounds.min[2]) / 2) * cropX;
  const corners = boxCorners([cx - hx, bounds.min[1], cz - hz], [cx + hx, bounds.max[1], cz + hz]);
  const target = new THREE.Vector3(...shot.target), dir = isoDirection(shot.yaw, shot.pitch);
  const lim = 1 - shot.margin;
  const fits = (d: number) => project({ position: target.clone().addScaledVector(dir, d), target, fov }, aspect, corners)
    .every((p) => p.z < 1 && Math.abs(p.x) <= lim && Math.abs(p.y) <= lim);
  let lo = 1, hi = 400;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}

export function isoCameraPose(shot: IsoShot, bounds: { min: Vec3; max: Vec3 }, aspect: number): CameraPose {
  const target = new THREE.Vector3(...shot.target);
  const d = fitIsoDistance(shot, bounds, aspect);
  return { position: target.clone().addScaledVector(isoDirection(shot.yaw, shot.pitch), d), target, fov: responsiveShot(shot, aspect).fov };
}

export const projectForTest = project;
