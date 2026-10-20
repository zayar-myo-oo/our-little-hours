// Pure Pomodoro state machine. Uses absolute timestamps so it survives reloads.
export type Phase = "focus" | "shortBreak" | "longBreak";

export interface PomodoroConfig { focusMin: number; shortBreakMin: number; longBreakMin: number; longBreakEvery: number }
export interface PomodoroState {
  phase: Phase;
  running: boolean;
  /** epoch ms when the running phase ends (only while running) */
  endsAt: number | null;
  /** ms remaining when paused / idle */
  remainingMs: number;
  completedFocus: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4 };

export const phaseDurationMs = (phase: Phase, c: PomodoroConfig) =>
  (phase === "focus" ? c.focusMin : phase === "shortBreak" ? c.shortBreakMin : c.longBreakMin) * 60_000;

export const initialState = (c: PomodoroConfig = DEFAULT_CONFIG): PomodoroState => ({
  phase: "focus", running: false, endsAt: null, remainingMs: phaseDurationMs("focus", c), completedFocus: 0,
});

export const remaining = (s: PomodoroState, now: number) =>
  s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;

export const start = (s: PomodoroState, now: number): PomodoroState =>
  s.running ? s : { ...s, running: true, endsAt: now + s.remainingMs };

export const pause = (s: PomodoroState, now: number): PomodoroState =>
  !s.running ? s : { ...s, running: false, endsAt: null, remainingMs: remaining(s, now) };

export const reset = (s: PomodoroState, c: PomodoroConfig): PomodoroState =>
  ({ ...s, running: false, endsAt: null, remainingMs: phaseDurationMs(s.phase, c) });

export const switchPhase = (s: PomodoroState, phase: Phase, c: PomodoroConfig): PomodoroState =>
  ({ ...s, phase, running: false, endsAt: null, remainingMs: phaseDurationMs(phase, c) });

export const nextPhase = (s: PomodoroState, c: PomodoroConfig): { phase: Phase; completedFocus: number } => {
  if (s.phase !== "focus") return { phase: "focus", completedFocus: s.completedFocus };
  const completedFocus = s.completedFocus + 1;
  return { phase: completedFocus % c.longBreakEvery === 0 ? "longBreak" : "shortBreak", completedFocus };
};

/** Advance if the running phase has finished. Returns finished phase for notifications. */
export const tick = (s: PomodoroState, now: number, c: PomodoroConfig): { state: PomodoroState; finished: Phase | null } => {
  if (!s.running || remaining(s, now) > 0) return { state: s, finished: null };
  const n = nextPhase(s, c);
  return {
    finished: s.phase,
    state: { phase: n.phase, completedFocus: n.completedFocus, running: false, endsAt: null, remainingMs: phaseDurationMs(n.phase, c) },
  };
};

export const formatMs = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
