"use client";
import { useEffect, useRef, useState } from "react";
import type { Availability } from "@/systems/character/schedule";
import { isFeatureEnabled } from "@/lib/featureFlags";

interface Handle { setState(s: Availability): void; setReducedMotion(r: boolean): void; setRain?(on: boolean): void; destroy(): void }
type Mode = "3d" | "2d";
type Active = "world" | Mode | "css";

/** Living World (feature flag, default off) replaces the 3D room; any failure falls back down the chain. */
const initialFor = (mode: Mode): Active => (mode === "3d" && isFeatureEnabled("livingWorld") ? "world" : mode);
const FALLBACK: Record<Exclude<Active, "css">, Active> = { world: "3d", "3d": "2d", "2d": "css" };

/** Living World (flagged) → 3D (three.js) room → 2D PixiJS room → CSS scene. */
export function Room({ state, reducedMotion, rain, mode, modelUrl, onModelError }: { state: Availability; reducedMotion: boolean; rain: boolean; mode: Mode; modelUrl: string | null; onModelError?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Handle | null>(null);
  const [active, setActive] = useState<Active>(() => initialFor(mode));

  useEffect(() => { setActive(initialFor(mode)); }, [mode]);

  useEffect(() => {
    if (active === "css") return;
    let cancelled = false;
    (async () => {
      try {
        const webgl = (await import("./scene")).webglAvailable();
        if (!webgl) throw new Error("no webgl");
        const h: Handle = active === "world"
          ? await (await import("../world/WorldRenderer")).createWorldScene(host.current!, { reducedMotion, state, rain, modelUrl })
          : active === "3d"
          ? await (await import("../room3d/scene3d")).createScene3D(host.current!, { reducedMotion, state, rain, modelUrl })
          : await (await import("./scene")).createScene(host.current!, { reducedMotion, state, night: new Date().getHours() >= 18 || new Date().getHours() < 6 });
        if (cancelled) { h.destroy(); return; }
        scene.current = h;
        const ready = (h as { modelReady?: Promise<boolean> }).modelReady; // the world renderer loads the model in the background
        const loaded = ready ? await ready : !!(h as { hasVrm?: boolean }).hasVrm;
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
  return <div key={`${active}:${modelUrl}`} ref={host} className="absolute inset-0" aria-hidden />;
}
