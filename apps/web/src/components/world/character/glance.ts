// Occasional glances at the viewer: every 20–45 s she turns her head and eyes toward the camera for ~2.5 s,
// with eased in/out so it never snaps. Pure (seeded timing + clamped angles) so it can be tested.
import { nextRandom } from "@/world/sim/rng";

export interface GlanceTiming { minGap: number; maxGap: number; hold: number; ramp: number } // seconds
export const DEFAULT_GLANCE: GlanceTiming = { minGap: 20, maxGap: 45, hold: 2.5, ramp: 0.5 };

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export class GlanceScheduler {
  private nextAt: number; private startedAt = -Infinity; private rng: number;
  constructor(seed: number, now: number, private timing = DEFAULT_GLANCE) { this.rng = seed | 0; this.nextAt = now + this.gap(); }
  private gap() { const [r, n] = nextRandom(this.rng); this.rng = n; return this.timing.minGap + r * (this.timing.maxGap - this.timing.minGap); }

  /**
   * Glance weight 0…1 at time `now` (seconds). `allowed` = she's awake, settled and not walking; a glance only
   * STARTS while allowed, and one in progress eases out early if it stops being allowed.
   */
  weight(now: number, allowed: boolean): number {
    const { hold, ramp } = this.timing, len = hold + 2 * ramp;
    let t = now - this.startedAt;
    if (t >= len) { // idle: maybe start the next glance
      if (!allowed || now < this.nextAt) return 0;
      this.startedAt = now; this.nextAt = now + len + this.gap(); t = 0;
    }
    if (!allowed && t < ramp + hold) { // interrupted: skip to the fade-out, starting from the current strength
      const current = t < ramp ? smooth(t / ramp) : 1;
      this.startedAt = now - (len - ramp * current); t = now - this.startedAt;
    }
    return t < ramp ? smooth(t / ramp) : t > ramp + hold ? smooth((len - t) / ramp) : 1;
  }

  /** Force a glance now (e.g. right after she arrives somewhere, or when tapped). */
  glanceNow(at: number) { this.nextAt = at; }
}

export interface HeadTurn { yaw: number; pitch: number }
/**
 * Head rotation (relative to her body) that faces `target` from `head`, given the body's facing yaw.
 * Clamped to what a neck can do (±70° sideways, ±25° up/down); beyond that she only turns as far as she can.
 */
export function headTurnToward(head: [number, number, number], bodyYaw: number, target: [number, number, number], maxYaw = 1.2, maxPitch = 0.44): HeadTurn {
  const dx = target[0] - head[0], dy = target[1] - head[1], dz = target[2] - head[2];
  let yaw = Math.atan2(dx, dz) - bodyYaw;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); // wrap to (−π, π]
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return { yaw: Math.max(-maxYaw, Math.min(maxYaw, yaw)), pitch: Math.max(-maxPitch, Math.min(maxPitch, pitch)) };
}
