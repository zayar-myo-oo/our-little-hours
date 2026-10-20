// Mio's autonomous life simulation: pure, deterministic, independent of React and rendering.
//
// Time advances in whole segments (an activity at an anchor, or a walk between anchors). When a segment ends,
// its effects are applied to the needs and the planner picks what comes next. Because planning only happens at
// segment boundaries and uses the seeded RNG stored in the state, advancing in one big step or many small ones
// gives the same result (tested), which makes offline catch-up exact.
//
// Rule: this file never reads the clock (`Date`) or uses `Math.random` — callers pass `now`.
import type { AnchorId, AnchorPose, Vec3 } from "@/world/locations/schema";
import { nextRandom } from "./rng";
import { localParts, parseHM, inWindow, msUntilMinute } from "./time";
import { findPath, pathLength, type NavGraph } from "./nav";

export const NEEDS = ["energy", "mood", "creativity", "focus", "social"] as const;
export type Need = (typeof NEEDS)[number];
export type Needs = Record<Need, number>;
export type ActivityId = "studying" | "reading" | "relaxing" | "tea" | "window" | "sleeping";
export type SegmentKind = ActivityId | "walking";

export interface ActivityDef { anchor: AnchorId; minutes: [number, number]; perHour: Partial<Needs>; requires?: Partial<Needs>; pose: AnchorPose; label: string }
export interface ActivitiesDoc {
  version: number; walkSpeed: number; passivePerHour: Partial<Needs>;
  activities: Record<ActivityId, ActivityDef>;
  sleepWindow: { weekday: [string, string]; weekend: [string, string] };
  routine: { weekday: RoutineBlock[]; weekend: RoutineBlock[] };
  personality: { id: string; weights: Partial<Record<ActivityId, number>> };
}
interface RoutineBlock { from: string; to: string; bias: Partial<Record<ActivityId, number>> }

export interface Segment {
  kind: SegmentKind;
  anchor: AnchorId;          // where the activity happens (for walks: the destination)
  start: number; end: number;
  from?: AnchorId; path?: Vec3[]; next?: ActivityId; // walking only
}
export interface SimEvent { at: number; kind: "activity"; activity: ActivityId; anchor: AnchorId; minutes: number }
export interface SimState {
  version: 1;
  seed: number; rng: number;
  now: number;               // last simulated timestamp (ms)
  location: "study";
  anchor: AnchorId;          // where she is (or is walking to)
  current: Segment;
  needs: Needs;
  history: { kind: ActivityId; anchor: AnchorId; start: number; end: number }[]; // recent, newest last (≤ 20)
  events: SimEvent[];        // for "while you were away" (≤ 200)
}
export interface SimContext { tzOffsetMin: number; defs: ActivitiesDoc; nav: NavGraph }

export const MAX_CATCH_UP_MS = 7 * 86_400_000;
const MAX_SEGMENTS_PER_ADVANCE = 20_000;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

// ---- planning --------------------------------------------------------------------------------------------
function sleepWindow(ms: number, ctx: SimContext) {
  const p = localParts(ms, ctx.tzOffsetMin);
  const [from, to] = (p.weekend ? ctx.defs.sleepWindow.weekend : ctx.defs.sleepWindow.weekday).map(parseHM);
  return { inside: inWindow(p.minuteOfDay, from, to), wakeMinute: to, p };
}

function routineBias(ms: number, ctx: SimContext): Partial<Record<ActivityId, number>> {
  const p = localParts(ms, ctx.tzOffsetMin);
  const blocks = p.weekend ? ctx.defs.routine.weekend : ctx.defs.routine.weekday;
  return blocks.find((b) => inWindow(p.minuteOfDay, parseHM(b.from), parseHM(b.to)))?.bias ?? {};
}

/** Activities she may start now (impossible transitions are excluded here). */
export function allowedActivities(s: SimState, at: number, ctx: SimContext): ActivityId[] {
  const { inside } = sleepWindow(at, ctx);
  if (inside) return ["sleeping"];
  return (Object.keys(ctx.defs.activities) as ActivityId[]).filter((id) => {
    if (id === "sleeping") return false;
    const req = ctx.defs.activities[id].requires ?? {};
    return NEEDS.every((n) => req[n] === undefined || s.needs[n] >= req[n]!);
  });
}

export function scoreActivity(s: SimState, id: ActivityId, at: number, ctx: SimContext): number {
  const def = ctx.defs.activities[id];
  let score = 0;
  for (const n of NEEDS) {
    const urgency = ((100 - s.needs[n]) / 50) ** 2; // 0 (satisfied) … 4 (empty)
    score += urgency * (def.perHour[n] ?? 0) * 0.5;
  }
  score += routineBias(at, ctx)[id] ?? 0;
  score += ((ctx.defs.personality.weights[id] ?? 1) - 1) * 40;
  const recent = s.history.slice(-4);
  if (recent.at(-1)?.kind === id) score -= 60;                    // never the same thing twice in a row unless nothing else fits
  score -= recent.filter((h) => h.kind === id).length * 12;      // and not too often lately
  return score;
}

function choose(s: SimState, at: number, ctx: SimContext): ActivityId {
  const options = allowedActivities(s, at, ctx);
  if (options.length === 1) return options[0];
  let best: ActivityId = options[0], bestScore = -Infinity;
  for (const id of options) {
    const [r, next] = nextRandom(s.rng); s.rng = next;
    const sc = scoreActivity(s, id, at, ctx) + r * 10; // small noise for variety, still seeded
    if (sc > bestScore) { bestScore = sc; best = id; }
  }
  return best;
}

function activityDuration(s: SimState, id: ActivityId, at: number, ctx: SimContext): number {
  const def = ctx.defs.activities[id];
  if (id === "sleeping") {
    const { wakeMinute } = sleepWindow(at, ctx);
    return Math.min(def.minutes[1] * 60_000, Math.max(def.minutes[0] * 60_000, msUntilMinute(at, ctx.tzOffsetMin, wakeMinute)));
  }
  const [r, next] = nextRandom(s.rng); s.rng = next;
  return Math.round((def.minutes[0] + r * (def.minutes[1] - def.minutes[0])) * 60_000);
}

/** Plan the segment that starts at `at` (mutates s). */
function planNext(s: SimState, at: number, ctx: SimContext) {
  const pending = s.current.kind === "walking" ? s.current.next : undefined;
  const id = pending ?? choose(s, at, ctx);
  const def = ctx.defs.activities[id];
  if (def.anchor !== s.anchor) {
    const path = findPath(ctx.nav, s.anchor, def.anchor);
    if (path) {
      const ms = Math.max(2000, Math.round((pathLength(path) / ctx.defs.walkSpeed) * 1000));
      s.current = { kind: "walking", anchor: def.anchor, from: s.anchor, path, start: at, end: at + ms, next: id };
      s.anchor = def.anchor;
      return;
    }
    s.anchor = def.anchor; // unreachable in a valid location; teleport rather than get stuck
  }
  s.current = { kind: id, anchor: def.anchor, start: at, end: at + activityDuration(s, id, at, ctx) };
}

function complete(s: SimState, ctx: SimContext) {
  const seg = s.current, hours = (seg.end - seg.start) / 3_600_000;
  const per = seg.kind === "walking" ? {} : ctx.defs.activities[seg.kind].perHour;
  for (const n of NEEDS) s.needs[n] = clamp(s.needs[n] + ((per[n] ?? 0) + (ctx.defs.passivePerHour[n] ?? 0)) * hours);
  if (seg.kind !== "walking") {
    s.history = [...s.history, { kind: seg.kind, anchor: seg.anchor, start: seg.start, end: seg.end }].slice(-20);
    s.events = [...s.events, { at: seg.end, kind: "activity" as const, activity: seg.kind, anchor: seg.anchor, minutes: Math.round((seg.end - seg.start) / 60_000) }].slice(-200);
  }
}

// ---- public API ------------------------------------------------------------------------------------------
export function createInitialState(seed: number, now: number, ctx: SimContext): SimState {
  const s: SimState = {
    version: 1, seed, rng: seed | 0, now, location: "study", anchor: "desk",
    current: { kind: "relaxing", anchor: "desk", start: now, end: now }, // zero-length bootstrap, replaced below
    needs: { energy: 75, mood: 70, creativity: 60, focus: 70, social: 60 }, history: [], events: [],
  };
  planNext(s, now, ctx);
  return s;
}

/** Advance the simulation to `now`. Pure: returns a new state. */
export function advance(state: SimState, now: number, ctx: SimContext): SimState {
  const s: SimState = structuredClone(state);
  for (let i = 0; s.current.end <= now && i < MAX_SEGMENTS_PER_ADVANCE; i++) {
    const at = s.current.end;
    complete(s, ctx);
    planNext(s, at, ctx);
  }
  s.now = Math.max(s.now, now);
  return s;
}

/**
 * Offline progression with a bound: at most `maxMs` (7 days) are simulated. A longer absence first skips ahead
 * (she is simply settled at her current spot), then the last 7 days are simulated in full.
 */
export function catchUp(state: SimState, now: number, ctx: SimContext, maxMs = MAX_CATCH_UP_MS): { state: SimState; skippedMs: number } {
  const gap = now - state.now;
  if (gap <= maxMs) return { state: advance(state, now, ctx), skippedMs: 0 };
  const resumeAt = now - maxMs;
  const s: SimState = structuredClone(state);
  const kind: ActivityId = s.current.kind === "walking" ? s.current.next ?? "relaxing" : s.current.kind;
  s.current = { kind, anchor: s.anchor, start: resumeAt, end: resumeAt }; // ends immediately → planning resumes at resumeAt
  s.now = resumeAt;
  return { state: advance(s, now, ctx), skippedMs: resumeAt - state.now };
}

export interface SimSnapshot {
  kind: SegmentKind; activity: ActivityId; anchor: AnchorId; pose: AnchorPose | "walk"; label: string;
  availability: "AVAILABLE" | "SLEEPING"; start: number; end: number; walk?: { from: AnchorId; path: Vec3[] };
}
/** What the renderer and UI need for the current moment. */
export function snapshot(s: SimState, ctx: SimContext): SimSnapshot {
  const c = s.current;
  const activity: ActivityId = c.kind === "walking" ? c.next ?? "relaxing" : c.kind;
  const def = ctx.defs.activities[activity];
  return {
    kind: c.kind, activity, anchor: c.anchor, start: c.start, end: c.end,
    pose: c.kind === "walking" ? "walk" : def.pose,
    label: c.kind === "walking" ? `Walking to the ${c.anchor === "tea" ? "tea corner" : c.anchor === "reading" ? "armchair" : c.anchor}` : def.label,
    availability: c.kind === "sleeping" ? "SLEEPING" : "AVAILABLE",
    walk: c.kind === "walking" && c.path && c.from ? { from: c.from, path: c.path } : undefined,
  };
}

/** Validate a persisted state (from olh-world-v1) before trusting it. */
export function isSimState(v: unknown): v is SimState {
  const s = v as SimState;
  return !!s && s.version === 1 && Number.isFinite(s.now) && Number.isFinite(s.rng) && typeof s.anchor === "string"
    && !!s.current && Number.isFinite(s.current.start) && Number.isFinite(s.current.end) && typeof s.current.kind === "string"
    && !!s.needs && NEEDS.every((n) => Number.isFinite(s.needs[n])) && Array.isArray(s.history) && Array.isArray(s.events);
}
