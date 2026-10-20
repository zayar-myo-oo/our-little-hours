// Shared cel-shading helpers for the 3D room: toon materials, ink outlines, primitives, canvas textures.
import * as THREE from "three";

export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Small deterministic PRNG so painted textures look the same on every load. */
export function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeKit(root: THREE.Object3D) {
  const grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const mats = new Map<number, THREE.MeshToonMaterial>();
  const extra: { dispose(): void }[] = [];
  const toon = (c: number) => { let m = mats.get(c); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: grad }); mats.set(c, m); } return m; };
  const outline = new THREE.MeshBasicMaterial({ color: 0x3a2730, side: THREE.BackSide });

  function mesh(geo: THREE.BufferGeometry, color: number | THREE.Material, pos: THREE.Vector3, parent: THREE.Object3D = root, line = 1.035) {
    const m = new THREE.Mesh(geo, typeof color === "number" ? toon(color) : color); m.position.copy(pos); parent.add(m);
    if (line) { const o = new THREE.Mesh(geo, outline); o.scale.setScalar(line); m.add(o); }
    return m;
  }
  const box = (w: number, h: number, d: number, c: number | THREE.Material, p: THREE.Vector3, parent?: THREE.Object3D, line?: number) =>
    mesh(new THREE.BoxGeometry(w, h, d), c, p, parent, line);
  function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, c: number, parent: THREE.Object3D = root, line = 1.06) {
    const dir = b.clone().sub(a), len = dir.length();
    const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), c, a.clone().add(b).multiplyScalar(0.5), parent, line);
    m.quaternion.setFromUnitVectors(v(0, 1, 0), dir.normalize());
    return m;
  }
  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d")!, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    extra.push(t); return t;
  }
  const track = <T extends { dispose(): void }>(x: T) => { extra.push(x); return x; };
  const toonMat = (p: THREE.MeshToonMaterialParameters) => track(new THREE.MeshToonMaterial({ gradientMap: grad, ...p }));

  return {
    toon, toonMat, mesh, box, limb, canvasTex, track, grad,
    dispose() { mats.forEach((m) => m.dispose()); extra.forEach((x) => x.dispose()); grad.dispose(); outline.dispose(); },
  };
}
export type Kit = ReturnType<typeof makeKit>;
