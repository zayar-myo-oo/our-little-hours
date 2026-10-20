// Runs Mio's simulation in the app: load from olh-world-v1, bounded offline catch-up, tick, save.
// Never touches the game save (olh-save-v1) — that isolation is enforced by createWorldPersistence.
import type { StateStorage } from "zustand/middleware";
import { createWorldPersistence } from "@/world/store/worldPersistence";
import { advance, catchUp, createInitialState, isSimState, joinFocus, leaveFocus, snapshot, type SimContext, type SimSnapshot, type SimState } from "@/world/sim/engine";
import { summarizeAway, type AwayLines, type AwaySummary } from "@/world/sim/away";

export type RuntimeStatus = "new" | "resumed" | "recovered" | "read-only";
export interface StartResult { status: RuntimeStatus; awayMs: number; skippedMs: number; resumedFrom: SimState | null; away: AwaySummary | null }
export interface RuntimeDeps {
  storage: StateStorage;
  ctx: Omit<SimContext, "tzOffsetMin">;
  now: () => number;
  tzOffsetMin: () => number;
  newSeed: () => number;
  awayLines?: AwayLines;
  /** false = never write (demo/fast-forward mode). */
  persist?: boolean;
}

export class SimRuntime {
  private persistence;
  private state: SimState | null = null;
  private listeners = new Set<(s: SimSnapshot) => void>();
  private lastKey = "";
  status: RuntimeStatus = "new";

  constructor(private deps: RuntimeDeps) { this.persistence = createWorldPersistence<SimState>(deps.storage, isSimState); }

  private ctx(): SimContext { return { ...this.deps.ctx, tzOffsetMin: this.deps.tzOffsetMin() }; }

  async start(): Promise<StartResult> {
    const now = this.deps.now();
    const loaded = await this.persistence.load();
    let resumedFrom: SimState | null = null, skippedMs = 0;
    if (loaded.status === "ok" && loaded.save.sim) {
      resumedFrom = loaded.save.sim;
      const r = catchUp(loaded.save.sim, now, this.ctx());
      this.state = r.state; skippedMs = r.skippedMs; this.status = "resumed";
    } else {
      this.state = createInitialState(this.deps.newSeed(), now, this.ctx());
      this.status = loaded.status === "future" ? "read-only" : loaded.status === "malformed" ? "recovered" : "new";
    }
    // The absence is "consumed" by this save, so the same absence never produces a second card.
    const away = resumedFrom && this.deps.awayLines ? summarizeAway(this.state.events, resumedFrom.now, now, this.deps.awayLines) : null;
    await this.save();
    this.emit();
    return { status: this.status, awayMs: resumedFrom ? Math.max(0, now - resumedFrom.now) : 0, skippedMs, resumedFrom, away };
  }

  /** Advance to the current time and notify listeners if what she's doing changed. */
  tick(): SimState | null {
    if (!this.state) return null;
    this.state = advance(this.state, this.deps.now(), this.ctx());
    this.emit();
    return this.state;
  }

  /** Focus Together: the user's Pomodoro focus phase runs until `until` (null = no focus session). */
  setUserFocus(until: number | null) {
    if (!this.state) return;
    const now = this.deps.now();
    this.state = until && until > now ? joinFocus(this.state, until, now, this.ctx()) : leaveFocus(this.state);
    this.emit();
  }

  async save() {
    if (!this.state || this.status === "read-only" || this.deps.persist === false) return;
    try { await this.persistence.save(this.state, this.deps.now()); } catch (e) { console.warn("[world] save failed", e); }
  }

  get current(): SimState | null { return this.state; }
  snapshot(): SimSnapshot | null { return this.state ? snapshot(this.state, this.ctx()) : null; }

  subscribe(fn: (s: SimSnapshot) => void) { this.listeners.add(fn); const s = this.snapshot(); if (s) fn(s); return () => { this.listeners.delete(fn); }; }

  private emit() {
    const s = this.snapshot(); if (!s) return;
    const key = `${s.kind}:${s.start}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    for (const fn of this.listeners) fn(s);
  }
}
