// Pure time-of-day palette for the 3D room (unit tested).
export type DayPhase = "morning" | "day" | "sunset" | "night";
export interface Palette {
  phase: DayPhase;
  skyTop: string; skyBottom: string; glow: string; cloud: string; cloudShade: string; city: string; cityWindow: string; fog: string;
  sun: number; sunIntensity: number; ambient: number; lamp: number; bloom: number; rays: boolean;
}

export function phaseFor(hour: number): DayPhase {
  if (hour >= 5 && hour < 9) return "morning";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "sunset";
  return "night";
}

const PALETTES: Record<DayPhase, Omit<Palette, "phase">> = {
  morning: { skyTop: "#9cc4f0", skyBottom: "#ffe6d2", glow: "rgba(255,236,210,0.95)", cloud: "#fff7f0", cloudShade: "#f1d6d3", city: "#c5c4dc", cityWindow: "#e6e4f2", fog: "#f7e7de",
    sun: 0xffe8cc, sunIntensity: 1.7, ambient: 1.0, lamp: 0.4, bloom: 0.3, rays: true },
  day: { skyTop: "#4f9ef0", skyBottom: "#e4f3ff", glow: "rgba(255,252,236,0.95)", cloud: "#ffffff", cloudShade: "#d9e2f5", city: "#b4c7e2", cityWindow: "#dbe7f6", fog: "#e2f0fb",
    sun: 0xffffff, sunIntensity: 2.0, ambient: 1.15, lamp: 0.2, bloom: 0.25, rays: true },
  sunset: { skyTop: "#5d5aa6", skyBottom: "#ffb48c", glow: "rgba(255,178,120,0.95)", cloud: "#ffd3bb", cloudShade: "#c697b9", city: "#8b7ea8", cityWindow: "#ffd6a0", fog: "#eab9a9",
    sun: 0xffa36b, sunIntensity: 1.5, ambient: 0.8, lamp: 1.2, bloom: 0.45, rays: true },
  night: { skyTop: "#0b1230", skyBottom: "#2d3770", glow: "rgba(190,205,255,0.35)", cloud: "#4a5488", cloudShade: "#2c3363", city: "#262c55", cityWindow: "#ffd98a", fog: "#1b2248",
    sun: 0x8fa6ff, sunIntensity: 0.35, ambient: 0.45, lamp: 1.5, bloom: 0.55, rays: false },
};

export const paletteFor = (hour: number): Palette => { const phase = phaseFor(hour); return { phase, ...PALETTES[phase] }; };
