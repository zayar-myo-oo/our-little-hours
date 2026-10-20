// Procedurally generated ambience via Web Audio — no audio files needed.
export type AmbientKind = "rain" | "room";

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private gains = new Map<AmbientKind, GainNode>();
  readonly supported = typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);

  private ensure(): AudioContext | null {
    if (!this.supported) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.gains.set("rain", this.buildRain(this.ctx));
      this.gains.set("room", this.buildRoom(this.ctx));
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext, brown: boolean) {
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private loop(ctx: AudioContext, brown: boolean) {
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(ctx, brown); src.loop = true; src.start(); return src;
  }

  private buildRain(ctx: AudioContext) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    const hiss = this.loop(ctx, false);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2500; bp.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0.25;
    hiss.connect(bp).connect(hg).connect(out);
    const rumble = this.loop(ctx, true);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
    const rg = ctx.createGain(); rg.gain.value = 0.6;
    rumble.connect(lp).connect(rg).connect(out);
    return out;
  }

  private buildRoom(ctx: AudioContext) {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    const n = this.loop(ctx, true);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
    const g = ctx.createGain(); g.gain.value = 0.8;
    n.connect(lp).connect(g).connect(out);
    return out;
  }

  /** volume 0..1; 0 effectively mutes. Must be called from a user gesture the first time. */
  setVolume(kind: AmbientKind, volume: number) {
    const ctx = this.ensure(); if (!ctx) return false;
    this.gains.get(kind)!.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.5, ctx.currentTime, 0.2);
    return true;
  }
}

let engine: AmbientEngine | null = null;
export const getAmbient = () => (engine ??= new AmbientEngine());
