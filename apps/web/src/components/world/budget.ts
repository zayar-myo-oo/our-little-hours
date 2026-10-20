// Scene cost measurement against the location manifest budgets (draw calls, triangles, texture memory).
import * as THREE from "three";

export interface SceneCost { drawCalls: number; triangles: number; textureMB: number; meshes: number }
export interface Budgets { maxDrawCalls: number; maxTriangles: number; maxTextureMB: number }

const trianglesOf = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.index.count : g.attributes.position?.count ?? 0;
  const range = g.drawRange.count === Infinity ? n : Math.min(n, g.drawRange.count);
  return Math.floor(range / 3);
};

/** Static estimate: one draw call per visible mesh/material (instanced meshes count once), triangles × instances. */
export function measureObject(root: THREE.Object3D): SceneCost {
  let drawCalls = 0, triangles = 0, meshes = 0;
  const textures = new Set<THREE.Texture>();
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    meshes++; drawCalls += mats.length; triangles += trianglesOf(mesh.geometry) * instances;
    for (const m of mats) for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) textures.add(v as THREE.Texture);
  });
  let bytes = 0;
  for (const t of textures) { const img = t.image as { width?: number; height?: number } | undefined; bytes += (img?.width ?? 0) * (img?.height ?? 0) * 4 * 1.33; }
  return { drawCalls, triangles, meshes, textureMB: +(bytes / 1048576).toFixed(2) };
}

export function overBudget(cost: Pick<SceneCost, "drawCalls" | "triangles"> & { textureMB?: number }, b: Budgets): string[] {
  const out: string[] = [];
  if (cost.drawCalls > b.maxDrawCalls) out.push(`draw calls ${cost.drawCalls} > ${b.maxDrawCalls}`);
  if (cost.triangles > b.maxTriangles) out.push(`triangles ${cost.triangles} > ${b.maxTriangles}`);
  if ((cost.textureMB ?? 0) > b.maxTextureMB) out.push(`textures ${cost.textureMB} MB > ${b.maxTextureMB} MB`);
  return out;
}
