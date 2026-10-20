// Location manifest (content/locations/<id>.json): schema types + validation. Pure; no three.js.
export type Vec3 = [number, number, number];
export type AnchorId = "desk" | "reading" | "window" | "tea";
export type AnchorPose = "sit_type" | "sit_relax" | "stand";
export type Layer = "backdrop" | "shell" | "props" | "foreground";

export const REQUIRED_ANCHORS: readonly AnchorId[] = ["desk", "reading", "window", "tea"];
const POSES: readonly AnchorPose[] = ["sit_type", "sit_relax", "stand"];
const LAYERS: readonly Layer[] = ["backdrop", "shell", "props", "foreground"];

export interface Anchor { pos: Vec3; faceY: number; pose: AnchorPose; seatTop?: number; label: string }
export interface PropPlacement { prefab: string; pos: Vec3; rotY?: number; layer: Layer }
export interface IsoShot { kind: "iso"; target: Vec3; yaw: number; pitch: number; fov: number; margin: number }
/** Cinematic close-up on an anchor. frameH = visible height (m) at the target; hold = seconds before auto returns to overview. */
export interface CloseupShot { targetOffset: Vec3; yaw: number; pitch: number; fov: number; frameH: number; hold: number }
export interface AssetEntry { id: string; kind: "procedural" | "file"; src?: string; status: "placeholder" | "final"; license: string; note?: string }
export interface LocationManifest {
  id: string; name: string; version: number;
  bounds: { min: Vec3; max: Vec3 };
  lighting: string;
  anchors: Record<AnchorId, Anchor>;
  props: PropPlacement[];
  camera: { overview: IsoShot; closeups: Record<AnchorId, CloseupShot> };
  assets: AssetEntry[];
  budgets: { maxDrawCalls: number; maxTriangles: number; maxTextureMB: number };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const inside = (p: Vec3, b: { min: Vec3; max: Vec3 }) => p.every((c, i) => c >= b.min[i] - 1e-6 && c <= b.max[i] + 1e-6);

/** Returns a list of problems; empty means valid. `knownPrefabs` comes from the prefab registry. */
export function validateLocation(m: unknown, knownPrefabs: readonly string[]): string[] {
  const errs: string[] = [];
  const o = m as Partial<LocationManifest> | null;
  if (!o || typeof o !== "object") return ["manifest: not an object"];
  if (typeof o.id !== "string" || !/^[a-z][a-z0-9_-]*$/.test(o.id)) errs.push("id: must be a lowercase slug");
  if (typeof o.name !== "string" || !o.name) errs.push("name: required");
  const b = o.bounds;
  const boundsOk = !!b && isVec3(b.min) && isVec3(b.max) && b.min.every((v, i) => v < b.max[i]);
  if (!boundsOk) errs.push("bounds: min/max must be vec3 with min < max");

  for (const id of REQUIRED_ANCHORS) {
    const a = o.anchors?.[id];
    if (!a) { errs.push(`anchors.${id}: missing`); continue; }
    if (!isVec3(a.pos)) errs.push(`anchors.${id}.pos: invalid`);
    else if (boundsOk && !inside(a.pos, b!)) errs.push(`anchors.${id}: outside bounds`);
    if (!isNum(a.faceY)) errs.push(`anchors.${id}.faceY: invalid`);
    if (!POSES.includes(a.pose)) errs.push(`anchors.${id}.pose: unknown "${a.pose}"`);
    if (a.pose !== "stand" && !(isNum(a.seatTop) && a.seatTop > 0.2 && a.seatTop < 1)) errs.push(`anchors.${id}.seatTop: required for seated poses`);
  }
  if (boundsOk && o.anchors) {
    const ids = REQUIRED_ANCHORS.filter((id) => o.anchors?.[id] && isVec3(o.anchors[id].pos));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const p = o.anchors[ids[i]].pos, q = o.anchors[ids[j]].pos;
      if (Math.hypot(p[0] - q[0], p[2] - q[2]) < 0.6) errs.push(`anchors.${ids[i]}/${ids[j]}: closer than 0.6 m`);
    }
  }

  if (!Array.isArray(o.props) || o.props.length === 0) errs.push("props: required");
  else o.props.forEach((p, i) => {
    if (!knownPrefabs.includes(p?.prefab)) errs.push(`props[${i}]: unknown prefab "${p?.prefab}"`);
    if (!isVec3(p?.pos)) errs.push(`props[${i}].pos: invalid`);
    else if (boundsOk && p.layer !== "backdrop" && !inside(p.pos, b!)) errs.push(`props[${i}] (${p.prefab}): outside bounds`);
    if (!LAYERS.includes(p?.layer)) errs.push(`props[${i}].layer: invalid`);
    if (p?.rotY !== undefined && !isNum(p.rotY)) errs.push(`props[${i}].rotY: invalid`);
  });

  const ov = o.camera?.overview;
  if (!ov || ov.kind !== "iso" || !isVec3(ov.target) || !isNum(ov.yaw) || !isNum(ov.pitch) || !isNum(ov.fov) || !isNum(ov.margin)) errs.push("camera.overview: invalid iso shot");
  else {
    if (ov.fov < 8 || ov.fov > 40) errs.push("camera.overview.fov: keep between 8° and 40° for an isometric look");
    if (ov.pitch <= 0.2 || ov.pitch >= 1.4) errs.push("camera.overview.pitch: must look down between ~12° and ~80°");
  }

  for (const id of REQUIRED_ANCHORS) {
    const c = o.camera?.closeups?.[id];
    if (!c) { errs.push(`camera.closeups.${id}: missing`); continue; }
    if (!isVec3(c.targetOffset) || !isNum(c.yaw) || !isNum(c.pitch) || !isNum(c.fov) || !isNum(c.frameH) || !isNum(c.hold)) { errs.push(`camera.closeups.${id}: invalid`); continue; }
    if (c.fov < 20 || c.fov > 50) errs.push(`camera.closeups.${id}.fov: keep between 20° and 50°`);
    if (c.pitch < 0 || c.pitch > 0.9) errs.push(`camera.closeups.${id}.pitch: keep between 0 and ~50°`);
    if (c.frameH < 0.5 || c.frameH > 4) errs.push(`camera.closeups.${id}.frameH: 0.5–4 m`);
  }

  if (!Array.isArray(o.assets)) errs.push("assets: required (asset manifest)");
  else o.assets.forEach((a, i) => {
    if (!a?.id || !["procedural", "file"].includes(a.kind)) errs.push(`assets[${i}]: invalid`);
    if (a?.kind === "file" && !a.src) errs.push(`assets[${i}]: file asset needs src`);
    if (!a?.license?.trim()) errs.push(`assets[${i}] (${a?.id}): license required`);
  });
  const bu = o.budgets;
  if (!bu || !isNum(bu.maxDrawCalls) || !isNum(bu.maxTriangles) || !isNum(bu.maxTextureMB)) errs.push("budgets: required");
  return errs;
}
