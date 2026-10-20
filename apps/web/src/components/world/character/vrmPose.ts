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
