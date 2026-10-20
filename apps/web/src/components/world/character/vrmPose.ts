// Pure VRM posing math, extracted from room3d/scene3d.ts (behaviour unchanged) so it can be unit-tested
// and reused by the Living World renderer.

export type BoneRotation = readonly [bone: string, x: number, y: number, z: number];

/** VRM 0.x models are rotated 180° by VRMUtils.rotateVRM0, so X/Z rotations must be mirrored. */
export const mirrorSign = (metaVersion: string | undefined) => (metaVersion === "0" ? -1 : 1);

/** Seated typing pose on normalized humanoid bones, already mirrored for the model's VRM version. */
export function seatedTypingPose(metaVersion: string | undefined): BoneRotation[] {
  const f = mirrorSign(metaVersion);
  const out: BoneRotation[] = [];
  const set = (bone: string, x: number, y: number, z: number) => out.push([bone, f * x, y, f * z]);
  for (const [side, k] of [["left", 1], ["right", -1]] as const) {
    set(`${side}UpperLeg`, -Math.PI / 2, 0, 0);
    set(`${side}LowerLeg`, Math.PI / 2, 0, 0);
    set(`${side}UpperArm`, 0, -k * 0.9, -k * 0.85);
    set(`${side}LowerArm`, 0, -k * 0.9, k * 0.8);
    set(`${side}Hand`, 0, 0, k * 0.15);
  }
  set("spine", 0.12, 0, 0);
  set("neck", 0.1, 0, 0);
  return out;
}

export const SEAT_TOP_Y = 0.56;   // hip height when seated on the default chair
export const KEYBOARD_HAND_Y = 0.8; // desk top is 0.775

/** Extra seat height so a posed model's hands reach the keyboard. Never lowers the seat. */
export const seatLift = (hipY: number, handY: number, seatTop = SEAT_TOP_Y, targetHandY = KEYBOARD_HAND_Y) =>
  Math.max(0, targetHandY - (seatTop + handY - hipY));

/** MToon materials are tuned for ~1.0 total light; dim the model when the room is brighter (day). */
export const mtoonDimFactor = (ambient: number, sunIntensity: number) =>
  Math.min(1, Math.max(0.45, 1.05 / (ambient + sunIntensity * 0.5)));

function mirrored(metaVersion: string | undefined, build: (set: (b: string, x: number, y: number, z: number) => void) => void): BoneRotation[] {
  const f = mirrorSign(metaVersion), out: BoneRotation[] = [];
  build((b, x, y, z) => out.push([b, f * x, y, f * z]));
  return out;
}

/** Sitting back in an armchair, hands resting on the lap. */
export const seatedRelaxedPose = (metaVersion: string | undefined) => mirrored(metaVersion, (set) => {
  for (const [side, k] of [["left", 1], ["right", -1]] as const) {
    set(`${side}UpperLeg`, -Math.PI / 2 + 0.1, 0, 0);
    set(`${side}LowerLeg`, Math.PI / 2 - 0.1, 0, 0);
    set(`${side}UpperArm`, 0, -k * 0.6, -k * 1.05);
    set(`${side}LowerArm`, 0, -k * 1.0, 0);
  }
  set("spine", -0.06, 0, 0);
  set("neck", 0.08, 0, 0);
});

/** Standing relaxed, arms down. Legs keep their rest pose. */
export const standingIdlePose = (metaVersion: string | undefined) => mirrored(metaVersion, (set) => {
  for (const [side, k] of [["left", 1], ["right", -1]] as const) {
    set(`${side}UpperArm`, 0, 0, -k * 1.2);
    set(`${side}LowerArm`, 0, -k * 0.15, 0);
  }
});

export type AnchorPoseId = "sit_type" | "sit_relax" | "stand";
export function poseFor(pose: AnchorPoseId, metaVersion: string | undefined): BoneRotation[] {
  return pose === "sit_type" ? seatedTypingPose(metaVersion) : pose === "sit_relax" ? seatedRelaxedPose(metaVersion) : standingIdlePose(metaVersion);
}

// ---- skirts (VRoid naming: J_Sec_<L|R>_Skirt<Front|Side|Back><segment>[_end]_<NN>) ---------------------------
export type SkirtPart = "front" | "side" | "back";
export function classifySkirtBone(name: string): { part: SkirtPart; segment: number } | null {
  const m = /Skirt(Front|Side|Back)(\d+)(?!_end)_/i.exec(name);
  return m ? { part: m[1].toLowerCase() as SkirtPart, segment: Number(m[2]) } : null;
}

/**
 * Where a skirt panel should point when sitting, from how "front" it hangs: front = 1 (over the lap),
 * side = 0, back = -1. Returns a unit direction in the character's frame (x = her left/right as given by
 * `outward`, y = up, z = forward): front panels lie forward along the thighs with a slight droop, sides
 * angle outward and down, the back hangs down onto the seat.
 */
export function skirtDrapeDirection(frontness: number, outward: [number, number], knee = false): [number, number, number] {
  const f = Math.max(0, frontness), b = Math.max(0, -frontness);
  let x: number, y: number, z: number;
  if (knee) { x = outward[0] * 0.1; y = -1; z = 0.2 * f; }            // hem drops over the knees
  else { x = outward[0] * 0.35 * (1 - f); y = -(0.22 + 0.78 * (1 - f)) - 0.2 * b; z = f * 1.0 + outward[1] * 0.35 * (1 - f) - 0.15 * b; }
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}
