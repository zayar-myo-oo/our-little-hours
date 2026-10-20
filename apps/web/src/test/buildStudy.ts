import * as THREE from "three";
import { makeKit } from "@/components/room3d/kit";
import { paletteFor } from "@/components/room3d/timeOfDay";
import { buildPrefab } from "@/components/world/prefabs/registry";
import { mergeStatic } from "@/components/world/mergeStatic";
import type { PrefabId } from "@/components/world/prefabs/ids";
import study from "@content/locations/study.json";

/** Builds the study exactly like WorldRenderer (static layers merged). Needs a DOM (jsdom) for canvas textures. */
export function buildStudy(lowQuality = false) {
  const root = new THREE.Group(), kit = makeKit(root);
  const statics = new THREE.Group(), foreground = new THREE.Group();
  for (const p of study.props) {
    const o = buildPrefab(p.prefab as PrefabId, { kit, pal: paletteFor(12), lowQuality }).object;
    o.position.set(...(p.pos as [number, number, number])); o.rotation.y = p.rotY ?? 0;
    (p.layer === "foreground" ? foreground : statics).add(o);
  }
  mergeStatic(statics);
  root.add(statics, foreground);
  root.updateMatrixWorld(true);
  return { root, statics, foreground };
}
