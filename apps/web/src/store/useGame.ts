"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/systems/persistence/idbStorage";
import * as P from "@/systems/productivity/pomodoro";
import * as T from "@/systems/productivity/tasks";
import type { ChatMessage } from "@/systems/chat/types";
import * as S from "@/systems/story/engine";
import story from "@content/story/the-unfinished-page.json";
import { SAVE_KEY, SAVE_VERSION, migrateSave, sanitizeSave, type SanitizeContext, type Settings } from "./save/schema";
import { createVersionedStorage, listBackups, restoreBackup } from "./save/recovery";

export const STORY = story as S.Story;
export type Tab = "focus" | "tasks" | "music" | "chat" | "story" | "settings";

export type { Settings };

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
  reducedMotion: "system", renderMode: "3d", characterId: "girl-one", rainVolume: 0, roomVolume: 0, musicVolume: 0.6,
  chatProvider: "mock", ollamaUrl: "http://localhost:11434", ollamaModel: "llama3.2", notifications: false,
};

const fresh = () => ({
  tab: null as Tab | null, config: P.DEFAULT_CONFIG, timer: P.initialState(), tasks: [] as T.Task[],
  chat: [] as ChatMessage[], story: S.begin(STORY), settings: DEFAULT_SETTINGS,
});

const saveContext = (): SanitizeContext => {
  const d = fresh();
  return { defaults: { config: d.config, timer: d.timer, tasks: d.tasks, chat: d.chat, story: d.story, settings: d.settings }, isStoryNode: (id) => !!STORY.nodes[id], storyId: STORY.id };
};

const versionedStorage = createVersionedStorage(idbStorage, {
  onBackup: ({ key, kind, version }) => console.info(`[save] ${kind} save (version ${version ?? "?"}) backed up to "${key}" before migration`),
});

/** Manual recovery from the browser console: `await olhRecovery.list()`, `await olhRecovery.restore(key)` then reload. */
if (typeof window !== "undefined") {
  (window as unknown as { olhRecovery: unknown }).olhRecovery = {
    list: () => listBackups(idbStorage, SAVE_KEY),
    restore: (key: string) => restoreBackup(idbStorage, SAVE_KEY, key),
  };
}

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
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => versionedStorage),
      partialize: ({ config, timer, tasks, chat, story, settings }) => ({ config, timer, tasks, chat, story, settings }),
      // Runs only when the stored version differs (legacy v0 or a future version). The raw save is already backed up.
      migrate: (persisted, fromVersion) => {
        const { save, issues } = migrateSave(persisted, fromVersion, saveContext());
        if (issues.length) console.warn("[save] migration repaired:", issues);
        return save as unknown as GameState;
      },
      // Runs on every load: validate field by field so one bad value never discards the rest of the save.
      merge: (persisted, current) => {
        if (persisted === undefined || persisted === null) return current;
        const { save, issues } = sanitizeSave(persisted, saveContext());
        if (issues.length) console.warn("[save] load repaired:", issues);
        return { ...current, ...save };
      },
    },
  ),
);
