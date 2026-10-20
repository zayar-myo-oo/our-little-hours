// Foreground occlusion: objects on the "foreground" layer fade out while they block the view of the character.
import * as THREE from "three";

const ray = new THREE.Raycaster();

/** Which candidate roots block the line of sight from the camera to any of the target points. */
export function findOccluders(camera: THREE.Camera, targets: THREE.Vector3[], candidates: THREE.Object3D[]): Set<THREE.Object3D> {
  const hit = new Set<THREE.Object3D>();
  const origin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  for (const t of targets) {
    const dir = t.clone().sub(origin), dist = dir.length();
    ray.set(origin, dir.normalize()); ray.far = dist;
    for (const c of candidates) if (!hit.has(c) && ray.intersectObject(c, true).length) hit.add(c);
  }
  return hit;
}

/** Give a foreground prop its own transparent materials so fading it never affects shared materials. */
export function makeFadeable(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const clone = (m: THREE.Material) => { const c = m.clone(); c.transparent = true; c.userData.baseOpacity = m.opacity; return c; };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  root.userData.fade = 1;
}

/** Ease each candidate's opacity towards 0.25 when occluding, back to 1 otherwise. Returns the new fade values. */
export function updateFades(candidates: THREE.Object3D[], occluding: Set<THREE.Object3D>, dt: number, instant: boolean) {
  for (const c of candidates) {
    const goal = occluding.has(c) ? 0.25 : 1, cur = (c.userData.fade as number) ?? 1;
    const next = instant ? goal : cur + (goal - cur) * Math.min(1, dt * 6);
    if (Math.abs(next - cur) < 1e-4 && next === cur) continue;
    c.userData.fade = next;
    c.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) { mat.opacity = ((mat.userData.baseOpacity as number) ?? 1) * next; mat.depthWrite = next > 0.99; }
    });
  }
}

/** Close-ups: foreground props nearer to the camera than the subject would fill the frame, so they all fade. */
export function nearerThanSubject(camera: THREE.Camera, subject: THREE.Vector3, candidates: THREE.Object3D[]): Set<THREE.Object3D> {
  const cam = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld), dSubject = cam.distanceTo(subject);
  const box = new THREE.Box3(), p = new THREE.Vector3();
  return new Set(candidates.filter((c) => box.setFromObject(c).clampPoint(cam, p).distanceTo(cam) < dSubject));
}
