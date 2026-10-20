"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/systems/persistence/idbStorage";
import * as P from "@/systems/productivity/pomodoro";
import * as T from "@/systems/productivity/tasks";
import type { ChatMessage } from "@/systems/chat/types";
import * as S from "@/systems/story/engine";
import story from "@content/story/the-unfinished-page.json";

export const STORY = story as S.Story;
export type Tab = "focus" | "tasks" | "music" | "chat" | "story" | "settings";

export interface Settings {
  reducedMotion: "system" | "on" | "off";
  renderMode: "3d" | "2d";
  characterId: string;
  rainVolume: number; roomVolume: number; musicVolume: number;
  chatProvider: "mock" | "ollama"; ollamaUrl: string; ollamaModel: string;
  notifications: boolean;
}

interface GameState {
  tab: Tab | null;
  setTab: (t: Tab | null) => void;
  config: P.PomodoroConfig;
  timer: P.PomodoroState;
  timerAction: (a: "start" | "pause" | "reset" | "tick" | P.Phase) => P.Phase | null;
  setConfig: (c: Partial<P.PomodoroConfig>) => void;
  tasks: T.Task[];
  taskAction: (a: { type: "add"; title: string } | { type: "toggle" | "remove"; id: string } | { type: "edit"; id: string; title: string } | { type: "clearDone" }) => void;
  chat: ChatMessage[];
  pushChat: (m: Omit<ChatMessage, "id" | "at">) => void;
  clearChat: () => void;
  story: S.StoryProgress;
  storyAdvance: (choice?: number) => void;
  storyRestart: () => void;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  resetAll: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  reducedMotion: "system", renderMode: "3d", characterId: "placeholder", rainVolume: 0, roomVolume: 0, musicVolume: 0.6,
  chatProvider: "mock", ollamaUrl: "http://localhost:11434", ollamaModel: "llama3.2", notifications: false,
};

const fresh = () => ({
  tab: null as Tab | null, config: P.DEFAULT_CONFIG, timer: P.initialState(), tasks: [] as T.Task[],
  chat: [] as ChatMessage[], story: S.begin(STORY), settings: DEFAULT_SETTINGS,
});

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...fresh(),
      setTab: (tab) => set({ tab }),
      timerAction: (a) => {
        const { timer, config } = get(), now = Date.now();
        if (a === "tick") { const r = P.tick(timer, now, config); if (r.finished) set({ timer: r.state }); return r.finished; }
        const next = a === "start" ? P.start(timer, now) : a === "pause" ? P.pause(timer, now) : a === "reset" ? P.reset(timer, config) : P.switchPhase(timer, a, config);
        set({ timer: next });
        return null;
      },
      setConfig: (c) => {
        const config = { ...get().config, ...c };
        const t = get().timer;
        set({ config, timer: t.running ? t : P.reset(t, config) });
      },
      taskAction: (a) => set(({ tasks }) => ({
        tasks: a.type === "add" ? T.addTask(tasks, a.title) : a.type === "toggle" ? T.toggleTask(tasks, a.id)
          : a.type === "remove" ? T.removeTask(tasks, a.id) : a.type === "edit" ? T.editTask(tasks, a.id, a.title) : T.clearDone(tasks),
      })),
      pushChat: (m) => set(({ chat }) => ({ chat: [...chat, { ...m, id: `${Date.now()}-${Math.random()}`, at: Date.now() }].slice(-100) })),
      clearChat: () => set({ chat: [] }),
      storyAdvance: (choice) => set(({ story: p }) => ({ story: S.advance(STORY, p, choice) })),
      storyRestart: () => set({ story: S.begin(STORY) }),
      setSettings: (s) => set(({ settings }) => ({ settings: { ...settings, ...s } })),
      resetAll: () => set({ ...fresh() }),
    }),
    {
      name: "olh-save-v1",
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ config, timer, tasks, chat, story, settings }) => ({ config, timer, tasks, chat, story, settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        const ok = p.story && STORY.nodes[p.story.nodeId];
        return { ...current, ...p, settings: { ...current.settings, ...p.settings }, story: ok ? p.story! : current.story };
      },
    },
  ),
);
