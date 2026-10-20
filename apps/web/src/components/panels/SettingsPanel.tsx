"use client";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectSettingsPanel } from "@/store/selectors";
import { useGame, saveIsReadOnly } from "@/store/useGame";
import { Btn, Panel } from "./ui";
import { CharacterPicker } from "./CharacterPicker";
import type { CharacterModel } from "@/systems/character/models";

function SettingsPanelView({ apiStatus, models, modelError }: { apiStatus: string; models: CharacterModel[] | null; modelError: string | null }) {
  const { settings, setSettings, resetAll } = useGame(useShallow(selectSettingsPanel));
  const askNotify = async () => {
    if (!("Notification" in window)) return alert("Notifications are not supported here.");
    const p = await Notification.requestPermission();
    setSettings({ notifications: p === "granted" });
  };
  return (
    <Panel title="Settings">
      {settings.renderMode === "3d" && <CharacterPicker models={models} loadError={modelError} />}
      <label className="mb-3 block text-sm">Reduced motion
        <select value={settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.value as never })} className="mt-1 w-full rounded-lg bg-cream/10 px-2 py-1">
          <option value="system">Follow system</option><option value="on">On</option><option value="off">Off</option>
        </select>
      </label>
      <label className="mb-3 block text-sm">Room style
        <select value={settings.renderMode} onChange={(e) => setSettings({ renderMode: e.target.value as never })} className="mt-1 w-full rounded-lg bg-cream/10 px-2 py-1">
          <option value="3d">3D (three.js)</option><option value="2d">2D (lighter, for older devices)</option>
        </select>
      </label>
      <label className="mb-3 block text-sm">Chat mode
        <select value={settings.chatProvider} onChange={(e) => setSettings({ chatProvider: e.target.value as never })} className="mt-1 w-full rounded-lg bg-cream/10 px-2 py-1">
          <option value="mock">Scripted (offline)</option><option value="ollama">Ollama (local, optional)</option>
        </select>
      </label>
      {settings.chatProvider === "ollama" && (
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <input value={settings.ollamaUrl} onChange={(e) => setSettings({ ollamaUrl: e.target.value })} className="rounded-lg bg-cream/10 px-2 py-1" aria-label="Ollama URL" />
          <input value={settings.ollamaModel} onChange={(e) => setSettings({ ollamaModel: e.target.value })} className="rounded-lg bg-cream/10 px-2 py-1" aria-label="Ollama model" />
          <p className="col-span-2 opacity-60">Requires Ollama running locally with OLLAMA_ORIGINS allowing this site. Falls back to scripted replies.</p>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span>Timer notifications: {settings.notifications ? "on" : "off"}</span>
        {settings.notifications ? <Btn onClick={() => setSettings({ notifications: false })}>Turn off</Btn> : <Btn onClick={askNotify}>Enable</Btn>}
      </div>
      {saveIsReadOnly() && (
        <p className="mb-3 rounded-lg bg-amber-glow/15 p-2 text-xs">Your save was made by a newer version of the app, so changes here aren&apos;t saved. Open the latest version to keep your progress.</p>
      )}
      <p className="mb-3 text-xs opacity-60">Backend sync: {apiStatus}. Your progress is saved in this browser (IndexedDB).</p>
      <Btn onClick={() => confirm("Erase all local progress?") && resetAll()}>Reset local save</Btn>
    </Panel>
  );
}

export const SettingsPanel = memo(SettingsPanelView);
