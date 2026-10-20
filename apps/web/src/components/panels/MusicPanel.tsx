"use client";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectSettings } from "@/store/selectors";
import { useGame } from "@/store/useGame";
import { loadManifest, nextIndex, type Track } from "@/systems/audio/music";
import { getAmbient } from "@/systems/audio/ambient";
import { Btn, Panel, Slider } from "./ui";
import { asset } from "@/lib/asset";

/** Music player lives outside the panel so audio keeps playing when the panel closes. */
export function useMusic() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const volume = useGame((s) => s.settings.musicVolume);

  useEffect(() => { loadManifest().then(setTracks); audio.current = new Audio(); return () => audio.current?.pause(); }, []);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  useEffect(() => {
    const a = audio.current; if (!a) return;
    const onEnd = () => setIndex((i) => nextIndex(i, tracks?.length ?? 0));
    const onErr = () => { setError("This track could not be loaded. Check the file name in manifest.json."); setPlaying(false); };
    a.addEventListener("ended", onEnd); a.addEventListener("error", onErr);
    return () => { a.removeEventListener("ended", onEnd); a.removeEventListener("error", onErr); };
  }, [tracks]);
  useEffect(() => {
    const a = audio.current, t = tracks?.[index]; if (!a || !t) return;
    const src = asset(`/audio/music/${encodeURIComponent(t.file)}`);
    if (!a.src.endsWith(src)) a.src = src;
    if (playing) { setError(null); a.play().catch(() => { setError("Playback was blocked or failed."); setPlaying(false); }); } else a.pause();
  }, [index, playing, tracks]);

  return { tracks, index, setIndex, playing, setPlaying, error };
}

export function MusicPanel({ music }: { music: ReturnType<typeof useMusic> }) {
  const { settings, setSettings } = useGame(useShallow(selectSettings));
  const ambient = getAmbient();
  const { tracks, index, setIndex, playing, setPlaying, error } = music;
  const n = tracks?.length ?? 0;
  return (
    <Panel title="Music & Ambience">
      {tracks === null ? <p className="text-sm opacity-60">Loading playlist…</p> : n === 0 ? (
        <p className="mb-4 rounded-xl bg-cream/5 p-3 text-sm opacity-80">
          No music installed. Add your own licensed audio files to <code>public/audio/music/</code> and list them in <code>manifest.json</code> (see README).
        </p>
      ) : (
        <div className="mb-4">
          <p className="font-serif text-lg">{tracks[index]?.title}</p>
          <p className="mb-3 text-xs opacity-60">{tracks[index]?.artist} {tracks[index]?.license && `· ${tracks[index].license}`}</p>
          <div className="flex gap-2">
            <Btn onClick={() => setIndex(nextIndex(index, n, -1))} aria-label="Previous track">⏮</Btn>
            <Btn onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</Btn>
            <Btn onClick={() => setIndex(nextIndex(index, n))} aria-label="Next track">⏭</Btn>
          </div>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      )}
      {n > 0 && <Slider label="Music" value={settings.musicVolume} onChange={(v) => setSettings({ musicVolume: v })} />}
      {ambient.supported ? (
        <>
          <Slider label="Rain (generated)" value={settings.rainVolume} onChange={(v) => { setSettings({ rainVolume: v }); ambient.setVolume("rain", v); }} />
          <Slider label="Room hum (generated)" value={settings.roomVolume} onChange={(v) => { setSettings({ roomVolume: v }); ambient.setVolume("room", v); }} />
          <p className="text-xs opacity-50">Ambience is synthesized in your browser — no files needed.</p>
        </>
      ) : <p className="text-sm opacity-60">Web Audio is not supported in this browser, so ambience is unavailable.</p>}
    </Panel>
  );
}
