"use client";
import { useEffect, useMemo, useState } from "react";
import { useGame, type Tab } from "@/store/useGame";
import { currentBlock, nextChange, fmtMinutes } from "@/systems/character/schedule";
import { formatMs, remaining } from "@/systems/productivity/pomodoro";
import { Room } from "@/components/room/Room";
import { FocusPanel } from "@/components/panels/FocusPanel";
import { TasksPanel } from "@/components/panels/TasksPanel";
import { MusicPanel, useMusic } from "@/components/panels/MusicPanel";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { StoryPanel } from "@/components/panels/StoryPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { getAmbient } from "@/systems/audio/ambient";
import { loadModels, resolveModelUrl, type CharacterModel } from "@/systems/character/models";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "focus", label: "Focus", icon: "⏳" }, { id: "tasks", label: "Tasks", icon: "✎" }, { id: "music", label: "Music", icon: "♪" },
  { id: "chat", label: "Chat", icon: "✉" }, { id: "story", label: "Story", icon: "❦" }, { id: "settings", label: "Settings", icon: "⚙" },
];
const API = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [apiStatus, setApiStatus] = useState(API ? "checking…" : "not configured (offline mode)");
  const g = useGame();
  const music = useMusic();
  const [models, setModels] = useState<CharacterModel[] | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = useGame.persist.onFinishHydration(() => setHydrated(true));
    if (useGame.persist.hasHydrated()) setHydrated(true);
    loadModels().then(setModels);
    const id = setInterval(() => setNow(Date.now()), 500);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(mq.matches); const onMq = () => setSystemReduced(mq.matches); mq.addEventListener("change", onMq);
    if (API) fetch(`${API}/api/health`, { signal: AbortSignal.timeout(3000) }).then((r) => setApiStatus(r.ok ? "connected" : "unavailable")).catch(() => setApiStatus("unavailable (offline mode)"));
    return () => { unsub(); clearInterval(id); mq.removeEventListener("change", onMq); };
  }, []);

  useEffect(() => { setModelError(null); }, [g.settings.characterId]);

  // timer completion
  useEffect(() => {
    const finished = g.timerAction("tick");
    if (finished) {
      const msg = finished === "focus" ? "Focus session done — time for a break!" : "Break's over. Ready for another page?";
      g.pushChat({ from: "character", text: msg });
      if (g.settings.notifications && "Notification" in window && Notification.permission === "granted") new Notification("Our Little Hours", { body: msg });
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // restore ambient volumes after the first user gesture (browsers block autoplay)
  useEffect(() => {
    if (!hydrated) return;
    const once = () => { const a = getAmbient(); const s = useGame.getState().settings; if (s.rainVolume) a.setVolume("rain", s.rainVolume); if (s.roomVolume) a.setVolume("room", s.roomVolume); };
    window.addEventListener("pointerdown", once, { once: true });
    return () => window.removeEventListener("pointerdown", once);
  }, [hydrated]);

  const date = new Date(now);
  const block = currentBlock(date), next = nextChange(date);
  const reduced = g.settings.reducedMotion === "on" || (g.settings.reducedMotion === "system" && systemReduced);
  const charName = models?.find((m) => m.id === g.settings.characterId && m.available)?.name ?? "Yuzu";
  const tasksOpen = g.tasks.filter((t) => !t.done).length, hour = date.getHours();
  const ctx = useMemo(() => ({ name: charName, availability: block.state, activity: block.activity, tasksOpen, focusSessions: g.timer.completedFocus, hour }),
    [charName, block.state, block.activity, tasksOpen, g.timer.completedFocus, hour]);
  const dot = block.state === "AVAILABLE" ? "bg-emerald-400" : block.state === "BUSY" ? "bg-amber-400" : "bg-indigo-400";

  return (
    <main className={`relative h-[100dvh] w-full select-none overflow-hidden ${reduced ? "motion-reduce-all" : ""}`}>
      {hydrated && models !== null && (
        <Room state={block.state} reducedMotion={reduced} rain={g.settings.rainVolume > 0} mode={g.settings.renderMode}
          modelUrl={resolveModelUrl(models, g.settings.characterId)}
          onModelError={() => setModelError("That character couldn't be loaded, so the placeholder is shown. Check that the .vrm file is valid.")} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />

      {hydrated && (
      <header className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white [text-shadow:0_1px_8px_rgba(0,0,0,.45)]">
        <div>
          <p className="text-sm font-medium opacity-95">{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
          <p className="text-4xl font-semibold leading-tight tracking-tight tabular-nums sm:text-5xl">{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="mt-0.5 text-xs opacity-90">♫ {music.playing && music.tracks?.[music.index] ? music.tracks[music.index].title : "Our Little Room"}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] opacity-90"><span className={`h-2 w-2 rounded-full ${dot}`} />{charName} · {block.activity} · until {fmtMinutes(next.start)}</p>
        </div>
        <button onClick={() => g.setTab("focus")} className="pointer-events-auto rounded-2xl border border-white/30 bg-black/25 px-4 py-2 text-center backdrop-blur-md">
          <p className="text-xl font-semibold tabular-nums">{formatMs(remaining(g.timer, now))}</p>
          <p className="text-[11px] opacity-90">{g.timer.running ? (g.timer.phase === "focus" ? "Working" : "Break") : "Paused"}</p>
        </button>
      </header>
      )}

      {hydrated && g.tab && (
        <div className="absolute inset-x-0 bottom-24 flex justify-center px-3 sm:bottom-28 sm:justify-end sm:px-6">
          {g.tab === "focus" && <FocusPanel />}
          {g.tab === "tasks" && <TasksPanel />}
          {g.tab === "music" && <MusicPanel music={music} />}
          {g.tab === "chat" && <ChatPanel ctx={ctx} name={charName} />}
          {g.tab === "story" && <StoryPanel name={charName} />}
          {g.tab === "settings" && <SettingsPanel apiStatus={apiStatus} models={models} modelError={modelError} />}
        </div>
      )}

      <nav className="absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-label="Main">
        <ul className="flex gap-1 rounded-full border border-cream/15 bg-ink/70 p-1.5 backdrop-blur-md">
          {TABS.map((t) => (
            <li key={t.id}>
              <button onClick={() => g.setTab(g.tab === t.id ? null : t.id)} aria-pressed={g.tab === t.id}
                className={`flex flex-col items-center rounded-full px-3 py-1.5 text-cream transition sm:px-4 ${g.tab === t.id ? "bg-amber-glow/25" : "hover:bg-cream/10"}`}>
                <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                <span className="text-[10px] sm:text-xs">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
