// Save schema for `olh-save-v1`: explicit versioning, per-field validation and forward migrations.
// Pure module (no storage, no React) so it can be tested with realistic fixtures.
import type { PomodoroConfig, PomodoroState, Phase } from "@/systems/productivity/pomodoro";
import type { Task } from "@/systems/productivity/tasks";
import type { ChatMessage } from "@/systems/chat/types";
import type { StoryProgress } from "@/systems/story/engine";

export const SAVE_KEY = "olh-save-v1";
/** Schema version, stored INSIDE the state as `__schema`. v0 = legacy saves (no field). v1 = validated schema. */
export const SAVE_VERSION = 1;
export const SCHEMA_FIELD = "__schema";
/**
 * zustand's own envelope version. Kept at 0 forever so pre-M0 builds (which use version 0 and no migrate)
 * can still read new saves after a rollback instead of resetting them to defaults.
 */
export const ENVELOPE_VERSION = 0;

export interface Settings {
  reducedMotion: "system" | "on" | "off";
  renderMode: "3d" | "2d";
  characterId: string;
  rainVolume: number; roomVolume: number; musicVolume: number;
  chatProvider: "mock" | "ollama"; ollamaUrl: string; ollamaModel: string;
  notifications: boolean;
}

export interface GameSave {
  config: PomodoroConfig;
  timer: PomodoroState;
  tasks: Task[];
  chat: ChatMessage[];
  story: StoryProgress;
  settings: Settings;
}

export type SaveDefaults = GameSave;
export interface SanitizeContext { defaults: SaveDefaults; isStoryNode: (id: string) => boolean; storyId: string }
export interface SanitizeResult { save: GameSave; issues: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number => isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown, max = 10_000): v is string => typeof v === "string" && v.length <= max;
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): v is T => typeof v === "string" && (opts as readonly string[]).includes(v);

const PHASES = ["focus", "shortBreak", "longBreak"] as const satisfies readonly Phase[];
const MAX_TIMER_MS = 180 * 60_000;

function config(v: unknown, d: PomodoroConfig, issues: string[]): PomodoroConfig {
  if (!isObj(v)) { if (v !== undefined) issues.push("config: invalid, reset"); return d; }
  const out = { ...d };
  for (const k of ["focusMin", "shortBreakMin", "longBreakMin"] as const) {
    if (isInt(v[k], 1, 180)) out[k] = v[k]; else if (v[k] !== undefined) issues.push(`config.${k}: invalid`);
  }
  if (isInt(v.longBreakEvery, 1, 12)) out.longBreakEvery = v.longBreakEvery; else if (v.longBreakEvery !== undefined) issues.push("config.longBreakEvery: invalid");
  return out;
}

function timer(v: unknown, d: PomodoroState, issues: string[]): PomodoroState {
  if (!isObj(v)) { if (v !== undefined) issues.push("timer: invalid, reset"); return d; }
  const phase = oneOf(v.phase, PHASES) ? v.phase : d.phase;
  const completedFocus = isInt(v.completedFocus, 0, 1_000_000) ? v.completedFocus : d.completedFocus;
  const remainingMs = isNum(v.remainingMs) && v.remainingMs >= 0 && v.remainingMs <= MAX_TIMER_MS ? v.remainingMs : null;
  const running = v.running === true && isNum(v.endsAt);
  if (v.running === true && !isNum(v.endsAt)) issues.push("timer: running without endsAt, paused");
  if (remainingMs === null && !running) {
    issues.push("timer.remainingMs: invalid, reset");
    return { ...d, phase, completedFocus };
  }
  return { phase, completedFocus, running, endsAt: running ? (v.endsAt as number) : null, remainingMs: remainingMs ?? 0 };
}

function tasks(v: unknown, issues: string[]): Task[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { issues.push("tasks: not a list, ignored"); return []; }
  const seen = new Set<string>(), out: Task[] = [];
  for (const t of v) {
    if (!isObj(t) || !isStr(t.id, 200) || !t.id || !isStr(t.title, 200) || !t.title.trim()) { issues.push("tasks: dropped invalid entry"); continue; }
    if (seen.has(t.id)) { issues.push("tasks: dropped duplicate id"); continue; }
    seen.add(t.id);
    out.push({ id: t.id, title: t.title, done: t.done === true, createdAt: isNum(t.createdAt) ? t.createdAt : 0 });
  }
  return out.slice(0, 1000);
}

function chat(v: unknown, issues: string[]): ChatMessage[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { issues.push("chat: not a list, ignored"); return []; }
  const out: ChatMessage[] = [];
  for (const m of v) {
    if (!isObj(m) || !isStr(m.id, 200) || !oneOf(m.from, ["user", "character", "system"] as const) || !isStr(m.text, 4000)) { issues.push("chat: dropped invalid message"); continue; }
    out.push({ id: m.id, from: m.from, text: m.text, at: isNum(m.at) ? m.at : 0 });
  }
  return out.slice(-100);
}

function story(v: unknown, ctx: SanitizeContext, issues: string[]): StoryProgress {
  const d = ctx.defaults.story;
  if (!isObj(v)) { if (v !== undefined) issues.push("story: invalid, restarted"); return d; }
  if (!isStr(v.nodeId, 200) || !ctx.isStoryNode(v.nodeId)) { issues.push("story: unknown node, restarted"); return d; }
  const strs = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => isStr(x, 200)) : []);
  return {
    storyId: ctx.storyId, nodeId: v.nodeId, flags: [...new Set(strs(v.flags))], completed: v.completed === true,
    seen: [...new Set(strs(v.seen).filter((id) => ctx.isStoryNode(id)))],
  };
}

function settings(v: unknown, d: Settings, issues: string[]): Settings {
  if (!isObj(v)) { if (v !== undefined) issues.push("settings: invalid, reset"); return d; }
  const out: Settings = { ...d };
  const take = <K extends keyof Settings>(k: K, ok: (x: unknown) => boolean) => {
    if (v[k] === undefined) return;
    if (ok(v[k])) out[k] = v[k] as Settings[K]; else issues.push(`settings.${k}: invalid`);
  };
  const vol = (x: unknown) => isNum(x) && x >= 0 && x <= 1;
  take("reducedMotion", (x) => oneOf(x, ["system", "on", "off"] as const));
  take("renderMode", (x) => oneOf(x, ["3d", "2d"] as const));
  take("characterId", (x) => isStr(x, 64) && x.length > 0);
  take("rainVolume", vol); take("roomVolume", vol); take("musicVolume", vol);
  take("chatProvider", (x) => oneOf(x, ["mock", "ollama"] as const));
  take("ollamaUrl", (x) => isStr(x, 300) && /^https?:\/\//.test(x));
  take("ollamaModel", (x) => isStr(x, 100) && x.length > 0);
  take("notifications", (x) => typeof x === "boolean");
  return out;
}

/** Validate any persisted state (any version) into a safe GameSave. Valid fields are always kept. */
export function sanitizeSave(raw: unknown, ctx: SanitizeContext): SanitizeResult {
  const issues: string[] = [];
  const s = isObj(raw) ? raw : {};
  if (!isObj(raw)) issues.push("state: missing or not an object");
  const d = ctx.defaults;
  return {
    issues,
    save: {
      config: config(s.config, d.config, issues),
      timer: timer(s.timer, d.timer, issues),
      tasks: tasks(s.tasks, issues),
      chat: chat(s.chat, issues),
      story: story(s.story, ctx, issues),
      settings: settings(s.settings, d.settings, issues),
    },
  };
}

/**
 * Forward migrations, applied in order from `fromVersion`. Each step must be additive and idempotent.
 * v0 → v1: legacy unversioned saves; shape is unchanged, the step only normalizes through validation.
 * Future versions (> SAVE_VERSION) are not migrated "down": known fields are read best-effort and the raw
 * data is preserved in a backup by the storage layer (see recovery.ts).
 */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  0: (s) => s,
};

export function migrateSave(persisted: unknown, fromVersion: number, ctx: SanitizeContext): SanitizeResult {
  let s: unknown = persisted;
  if (isObj(s) && Number.isInteger(fromVersion) && fromVersion >= 0 && fromVersion < SAVE_VERSION) {
    for (let v = fromVersion; v < SAVE_VERSION; v++) s = MIGRATIONS[v]?.(s as Record<string, unknown>) ?? s;
  }
  return sanitizeSave(s, ctx);
}

/**
 * Schema version of a persisted state. Prefers `state.__schema`; falls back to the zustand envelope version
 * (development builds of M0 briefly wrote envelope version 1); no information means legacy v0.
 * Returns null if the stored version is present but invalid.
 */
export function schemaVersionOf(state: unknown, envelopeVersion: unknown): number | null {
  if (isObj(state) && state[SCHEMA_FIELD] !== undefined) return isInt(state[SCHEMA_FIELD], 0, 1_000_000) ? state[SCHEMA_FIELD] : null;
  if (envelopeVersion === undefined) return 0;
  return isInt(envelopeVersion, 0, 1_000_000) ? envelopeVersion : null;
}

export type RawKind = "empty" | "current" | "legacy" | "future" | "malformed";
/** Classify a raw string from storage without modifying it. */
export function inspectRaw(raw: string | null | undefined): { kind: RawKind; version: number | null } {
  if (raw == null || raw === "") return { kind: "empty", version: null };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { kind: "malformed", version: null }; }
  if (!isObj(parsed) || !isObj(parsed.state)) return { kind: "malformed", version: null };
  const v = schemaVersionOf(parsed.state, parsed.version);
  if (v === null) return { kind: "malformed", version: null };
  return { kind: v === SAVE_VERSION ? "current" : v < SAVE_VERSION ? "legacy" : "future", version: v };
}
