// Narrow selectors so panels re-render only when the data they show changes (used with zustand's useShallow).
import type { useGame } from "./useGame";
type State = ReturnType<typeof useGame.getState>;

export const selectFocus = (s: State) => ({ timer: s.timer, config: s.config, timerAction: s.timerAction, setConfig: s.setConfig });
export const selectTasks = (s: State) => ({ tasks: s.tasks, taskAction: s.taskAction });
export const selectStory = (s: State) => ({ story: s.story, storyAdvance: s.storyAdvance, storyRestart: s.storyRestart });
export const selectChat = (s: State) => ({
  chat: s.chat, pushChat: s.pushChat, clearChat: s.clearChat,
  chatProvider: s.settings.chatProvider, ollamaUrl: s.settings.ollamaUrl, ollamaModel: s.settings.ollamaModel,
});
export const selectSettings = (s: State) => ({ settings: s.settings, setSettings: s.setSettings });
export const selectSettingsPanel = (s: State) => ({ settings: s.settings, setSettings: s.setSettings, resetAll: s.resetAll });
export const selectOpenTaskCount = (s: State) => s.tasks.reduce((n, t) => n + (t.done ? 0 : 1), 0);
