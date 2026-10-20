// Merge static meshes that share a material into one mesh per material (fewer draw calls, same triangles).
// Only for things that never move or fade individually (room shell and furniture). Lights and other non-mesh
// objects are left in place.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const KEEP = ["position", "normal", "uv"] as const;

function normalized(geo: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!(KEEP as readonly string[]).includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.clearGroups();
  g.applyMatrix4(matrix);
  if (g === geo) g = g.clone();
  return g;
}

/** Returns how many meshes were merged into how many. */
export function mergeStatic(root: THREE.Object3D): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const merged: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.userData.noMerge) return;
    const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const list = groups.get(m.material) ?? [];
    list.push(normalized(m.geometry, local));
    groups.set(m.material, list);
    merged.push(m);
  });
  if (merged.length === 0) return { before: 0, after: 0 };
  for (const m of merged) { m.removeFromParent(); }
  // removing a parent mesh also removed its outline children from the tree; they were collected above as well
  let after = 0;
  for (const [mat, geos] of groups) {
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `merged:${(mat as THREE.Material).type}`;
    root.add(mesh); after++;
  }
  return { before: merged.length, after };
}
