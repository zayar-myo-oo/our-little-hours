// Hybrid camera: isometric overview ↔ cinematic close-ups with one perspective camera.
//
// The camera is described by CamState { target, yaw, pitch, fov, frameH } where frameH is the visible height
// (metres) at the target. Distance is DERIVED: d = frameH / (2·tan(fov/2)). Interpolating frameH and fov
// independently is what makes a transition a true dolly zoom: changing fov while frameH is held moves the
// camera so the subject keeps its on-screen size (a plain zoom would only change fov).
import * as THREE from "three";
import type { AnchorId, CloseupShot, Vec3 } from "@/world/locations/schema";

export interface CamState { target: Vec3; yaw: number; pitch: number; fov: number; frameH: number }
export type ShotId = "overview" | AnchorId;

const DEG = Math.PI / 180;
export const distanceFor = (frameH: number, fovDeg: number) => frameH / (2 * Math.tan((fovDeg * DEG) / 2));
export const frameHFor = (distance: number, fovDeg: number) => 2 * distance * Math.tan((fovDeg * DEG) / 2);

export function camDirection(yaw: number, pitch: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}

/** Camera position for a state (optionally with the distance clamped by collision). */
export function camPosition(s: CamState, maxDistance = Infinity): THREE.Vector3 {
  const d = Math.min(distanceFor(s.frameH, s.fov), maxDistance);
  return new THREE.Vector3(...s.target).addScaledVector(camDirection(s.yaw, s.pitch), d);
}

/** Convert an iso pose (position/target/fov from iso.ts) into a CamState. */
export function stateFromPose(pos: THREE.Vector3, target: THREE.Vector3, fov: number): CamState {
  const off = pos.clone().sub(target), d = off.length();
  return { target: target.toArray() as Vec3, yaw: Math.atan2(off.x, off.z), pitch: Math.asin(off.y / d), fov, frameH: frameHFor(d, fov) };
}

/** Portrait screens: keep at least `minWidth` metres visible horizontally at the subject. */
export const responsiveFrameH = (frameH: number, aspect: number, minWidth = 1.0) => Math.max(frameH, minWidth / Math.max(0.2, aspect));

export function closeupState(anchorPos: Vec3, shot: CloseupShot, aspect: number): CamState {
  return {
    target: [anchorPos[0] + shot.targetOffset[0], anchorPos[1] + shot.targetOffset[1], anchorPos[2] + shot.targetOffset[2]],
    yaw: shot.yaw, pitch: shot.pitch, fov: shot.fov, frameH: responsiveFrameH(shot.frameH, aspect),
  };
}

// ---- interpolation ---------------------------------------------------------------------------------------
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Shortest signed angular difference b − a in (−π, π]. */
export const angleDelta = (a: number, b: number) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d <= -Math.PI) d += 2 * Math.PI; return d; };

export function lerpState(a: CamState, b: CamState, e: number): CamState {
  return {
    target: [0, 1, 2].map((i) => a.target[i] + (b.target[i] - a.target[i]) * e) as Vec3,
    yaw: a.yaw + angleDelta(a.yaw, b.yaw) * e,
    pitch: a.pitch + (b.pitch - a.pitch) * e,
    fov: a.fov + (b.fov - a.fov) * e,
    frameH: Math.exp(Math.log(a.frameH) + (Math.log(b.frameH) - Math.log(a.frameH)) * e), // geometric: even zoom speed
  };
}

/**
 * Transition length from how far the view travels. Bounded to stay gentle (no whip pans):
 * ≥ 0.9 s, ≤ 2.4 s; large orientation or zoom changes get more time.
 */
export function transitionSeconds(a: CamState, b: CamState): number {
  const angle = Math.hypot(angleDelta(a.yaw, b.yaw), b.pitch - a.pitch);
  const zoom = Math.abs(Math.log(b.frameH / a.frameH));
  const move = Math.hypot(...a.target.map((v, i) => v - b.target[i]));
  const fov = Math.abs(b.fov - a.fov) / 20;
  return Math.min(2.4, Math.max(0.9, 0.6 + angle * 0.8 + zoom * 0.35 + move * 0.15 + fov * 0.3));
}

// ---- collision -------------------------------------------------------------------------------------------
/** Keep the camera in front of any obstacle between target and camera ("spring arm"). */
export function pullIn(desired: number, hitDistance: number | null, minDistance = 0.6, padding = 0.15): number {
  if (hitDistance === null || hitDistance >= desired) return desired;
  return Math.max(minDistance, hitDistance - padding);
}

// ---- director --------------------------------------------------------------------------------------------
export interface DirectorOptions { overview: CamState; closeups: Record<AnchorId, CamState>; holds: Record<AnchorId, number>; manualHoldSeconds?: number }

export class CameraDirector {
  private from: CamState; private to: CamState;
  private start = 0; private duration = 0;
  private shot: ShotId = "overview";
  private manualUntil = -Infinity;
  private returnAt = Infinity;
  reducedMotion = false;
  auto = true;

  constructor(private opts: DirectorOptions) { this.from = this.to = opts.overview; }

  get currentShot(): ShotId { return this.shot; }
  get transitioning() { return this.duration > 0; }

  /** Update shot targets after a resize (keeps the current shot, no animation). */
  /** Update shot targets (resize, or a new wide view). With `animate`, moves smoothly to the new target. */
  reframe(overview: CamState, closeups: Record<AnchorId, CamState>, now: number, animate = false) {
    const cur = this.sample(now);
    this.opts = { ...this.opts, overview, closeups };
    const target = this.shot === "overview" ? overview : closeups[this.shot];
    if (animate && !this.reducedMotion) { this.from = cur; this.to = target; this.start = now; this.duration = transitionSeconds(cur, target) * 1000; return; }
    this.to = target;
    if (this.duration === 0) this.from = this.to; else this.from = cur;
  }

  /**
   * Request a shot. "auto" requests (activity started) are ignored during a manual hold or when auto is off.
   * Interrupting a running transition starts the new one from the current in-between view (no jumps).
   */
  focus(id: ShotId, now: number, source: "auto" | "manual" = "manual"): boolean {
    if (source === "auto" && (!this.auto || now < this.manualUntil)) return false;
    if (source === "manual") this.manualUntil = now + (this.opts.manualHoldSeconds ?? 45) * 1000;
    const target = id === "overview" ? this.opts.overview : this.opts.closeups[id];
    if (!target) return false;
    if (id === this.shot && this.duration === 0) return true;
    const cur = this.sample(now);
    this.from = cur; this.to = target; this.shot = id; this.start = now;
    this.duration = this.reducedMotion ? 0 : transitionSeconds(cur, target) * 1000;
    if (this.duration === 0) this.from = target;
    this.returnAt = id !== "overview" && source === "auto" ? now + this.opts.holds[id] * 1000 : Infinity;
    return true;
  }

  /** Current camera state; also handles the automatic return to the overview after an auto close-up. */
  update(now: number): CamState {
    if (now >= this.returnAt) { this.returnAt = Infinity; this.focus("overview", now, "auto"); }
    return this.sample(now);
  }

  private sample(now: number): CamState {
    if (this.duration === 0) return this.to;
    const x = Math.min(1, Math.max(0, (now - this.start) / this.duration));
    if (x >= 1) { this.duration = 0; this.from = this.to; return this.to; }
    return lerpState(this.from, this.to, easeInOutCubic(x));
  }
}
