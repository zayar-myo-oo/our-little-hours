// Device quality tiers + frame limiting for mobile performance.
export type Tier = "low" | "medium" | "high";
export interface DeviceInfo { dpr: number; cores?: number; memoryGb?: number; mobile: boolean; saveData?: boolean }
export interface Quality { tier: Tier; pixelRatio: number; antialias: boolean; bloom: boolean; outlines: boolean; maxFps: number; particles: number }

export function detectTier(d: DeviceInfo): Tier {
  if (d.saveData) return "low";
  const cores = d.cores ?? 4, mem = d.memoryGb ?? 4;
  if (d.mobile) return cores <= 4 || mem <= 3 ? "low" : "medium";
  return cores <= 4 || mem <= 4 ? "medium" : "high";
}

export function qualityFor(tier: Tier, dpr: number): Quality {
  switch (tier) {
    case "low": return { tier, pixelRatio: 1, antialias: false, bloom: false, outlines: true, maxFps: 30, particles: 30 };
    case "medium": return { tier, pixelRatio: Math.min(1.5, dpr), antialias: true, bloom: false, outlines: true, maxFps: 60, particles: 70 };
    default: return { tier, pixelRatio: Math.min(2, dpr), antialias: true, bloom: true, outlines: true, maxFps: 60, particles: 120 };
  }
}

/** Override with ?quality=low|medium|high (handy for testing on desktop). */
export function parseQualityOverride(search: string): Tier | null {
  const q = new URLSearchParams(search).get("quality");
  return q === "low" || q === "medium" || q === "high" ? q : null;
}

export function readDeviceInfo(): DeviceInfo {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    dpr: window.devicePixelRatio || 1, cores: n.hardwareConcurrency, memoryGb: n.deviceMemory, saveData: n.connection?.saveData,
    mobile: /Android|iPhone|iPad|iPod/i.test(n.userAgent) || (n.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820),
  };
}

/** Skips frames to stay at or below maxFps (rAF still drives timing). */
export class FrameLimiter {
  private last = -Infinity;
  constructor(private maxFps: number) {}
  shouldRender(nowMs: number): boolean {
    if (this.maxFps >= 60) { this.last = nowMs; return true; }
    if (nowMs - this.last >= 1000 / this.maxFps - 2) { this.last = nowMs; return true; }
    return false;
  }
}
