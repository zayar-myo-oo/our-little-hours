"use client";
import { useEffect, useRef, useState } from "react";
import type { Availability } from "@/systems/character/schedule";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { SimSnapshot } from "@/world/sim/engine";

interface Handle { setState(s: Availability): void; setReducedMotion(r: boolean): void; setRain?(on: boolean): void; destroy(): void }
type Mode = "3d" | "2d";
type Active = "world" | Mode | "css";

/** Living World (feature flag, default off) replaces the 3D room; any failure falls back down the chain. */
const initialFor = (mode: Mode): Active => (mode === "3d" && isFeatureEnabled("livingWorld") ? "world" : mode);
const FALLBACK: Record<Exclude<Active, "css">, Active> = { world: "3d", "3d": "2d", "2d": "css" };

/** Living World (flagged) → 3D (three.js) room → 2D PixiJS room → CSS scene. */
export function Room({ state, reducedMotion, rain, mode, modelUrl, onModelError, sim = null, simNow }: { state: Availability; reducedMotion: boolean; rain: boolean; mode: Mode; modelUrl: string | null; onModelError?: () => void; sim?: SimSnapshot | null; simNow?: () => number }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Handle | null>(null);
  const simRef = useRef(sim); simRef.current = sim;
  const nowRef = useRef(simNow); nowRef.current = simNow;
  const [active, setActive] = useState<Active>(() => initialFor(mode));
  const [modelLoading, setModelLoading] = useState(false);
  const [cameraShot, setCameraShot] = useState("overview");
  const [autoCamera, setAutoCamera] = useState(true);
  const [view, setView] = useState<"cozy" | "cctv" | "dollhouse" | null>(() => {
    const ok = (v: string | null) => (v === "cozy" || v === "cctv" || v === "dollhouse" ? v : null);
    try { return ok(new URLSearchParams(location.search).get("view")) ?? ok(localStorage.getItem("olh-world-view")); } catch { return null; }
  });

  useEffect(() => { setActive(initialFor(mode)); }, [mode]);

  useEffect(() => {
    if (active === "css") return;
    let cancelled = false;
    (async () => {
      try {
        const webgl = (await import("./scene")).webglAvailable();
        if (!webgl) throw new Error("no webgl");
        const h: Handle = active === "world"
          ? await (await import("../world/WorldRenderer")).createWorldScene(host.current!, { reducedMotion, state, rain, modelUrl, onCameraShot: setCameraShot, view: view ?? undefined })
          : active === "3d"
          ? await (await import("../room3d/scene3d")).createScene3D(host.current!, { reducedMotion, state, rain, modelUrl })
          : await (await import("./scene")).createScene(host.current!, { reducedMotion, state, night: new Date().getHours() >= 18 || new Date().getHours() < 6 });
        if (cancelled) { h.destroy(); return; }
        scene.current = h;
        if (process.env.NODE_ENV === "development") (window as unknown as { __olhRoom?: unknown }).__olhRoom = h; // dev-only debugging handle
        (h as { applySim?(s: SimSnapshot | null, n?: () => number): void }).applySim?.(simRef.current, nowRef.current);
        const ready = (h as { modelReady?: Promise<boolean> }).modelReady; // the world renderer loads the model in the background
        if (ready && modelUrl) setModelLoading(true);
        const loaded = ready ? await ready : !!(h as { hasVrm?: boolean }).hasVrm;
        if (!cancelled) setModelLoading(false);
        if (!cancelled && modelUrl && active !== "2d" && !loaded) onModelError?.();
      } catch (e) {
        console.warn(`${active} room unavailable`, e);
        if (!cancelled) setActive(FALLBACK[active as Exclude<Active, "css">]);
      }
    })();
    return () => { cancelled = true; scene.current?.destroy(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, modelUrl]);

  useEffect(() => { scene.current?.setState(state); }, [state]);
  useEffect(() => { scene.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);
  useEffect(() => { scene.current?.setRain?.(rain); }, [rain]);
  useEffect(() => { (scene.current as { applySim?(s: SimSnapshot | null, n?: () => number): void } | null)?.applySim?.(sim, nowRef.current); }, [sim]);

  if (active === "css") {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-[#3b2e3f] via-[#5a3e3a] to-[#3a241b]" aria-label="Study room (simplified view)">
        <div className="absolute left-[12%] top-[14%] h-[40%] w-[30%] rounded-sm border-[10px] border-[#2a1a14] bg-gradient-to-b from-[#1d2440] to-[#2e3a5c]" />
        <div className="absolute bottom-[25%] left-1/2 h-[30%] w-[18%] -translate-x-1/2 rounded-t-[45%] bg-[#d98f7a]" />
        <div className="absolute bottom-[50%] left-1/2 h-[16%] w-[11%] -translate-x-1/2 rounded-full bg-[#f7dcc8]" />
        <div className="absolute bottom-[22%] left-[25%] h-[5%] w-[50%] bg-[#7a4a2c]" />
        <p className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-cream/60">Simplified view (WebGL unavailable)</p>
      </div>
    );
  }
  return (
    <>
      <div key={`${active}:${modelUrl}`} ref={host} className="absolute inset-0" aria-hidden />
      {active === "world" && (
        <div className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-1.5 rounded-2xl border border-cream/15 bg-ink/55 p-1.5 text-[11px] text-cream backdrop-blur" role="group" aria-label="Camera">
          <button title="Change the room view" onClick={() => {
            const w = scene.current as unknown as { setView(v: string): void; view: string; focusCamera(s: string): void } | null;
            const order = ["cozy", "cctv", "dollhouse"] as const;
            const next = order[(order.indexOf((w?.view ?? view ?? "cozy") as (typeof order)[number]) + 1) % order.length];
            w?.setView(next); w?.focusCamera("overview"); setView(next);
            try { localStorage.setItem("olh-world-view", next); } catch { /* storage blocked */ }
          }} className="rounded-xl bg-cream/10 px-2.5 py-1.5 hover:bg-cream/20">
            {({ cozy: "Cozy", cctv: "CCTV", dollhouse: "Dollhouse" } as const)[view ?? "cozy"]} ▸
          </button>
          {([["overview", "Room"], ["closeup", "Close-up"]] as const).map(([id, label]) => {
            const on = id === "overview" ? cameraShot === "overview" : cameraShot !== "overview";
            return (
              <button key={id} aria-pressed={on} onClick={() => {
                const w = scene.current as unknown as { focusCamera(s: string): void; anchor: string } | null;
                w?.focusCamera(id === "overview" ? "overview" : w.anchor);
              }} className={`rounded-xl px-2.5 py-1.5 ${on ? "bg-amber-glow/30" : "hover:bg-cream/10"}`}>{label}</button>
            );
          })}
          <button aria-pressed={autoCamera} title="Switch to close-ups automatically when she starts something"
            onClick={() => { const next = !autoCamera; setAutoCamera(next); (scene.current as unknown as { setAutoCamera(o: boolean): void } | null)?.setAutoCamera(next); }}
            className={`rounded-xl px-2.5 py-1.5 ${autoCamera ? "bg-cream/15" : "opacity-60 hover:bg-cream/10"}`}>Auto {autoCamera ? "on" : "off"}</button>
        </div>
      )}
      {modelLoading && (
        <p role="status" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full bg-ink/60 px-3 py-1 text-xs text-cream/90 backdrop-blur">
          Loading character…
        </p>
      )}
    </>
  );
}
