"use client";
import { useEffect, useRef, useState } from "react";
import { idbStorage } from "@/systems/persistence/idbStorage";
import { buildNav } from "@/world/sim/nav";
import type { ActivitiesDoc, SimSnapshot } from "@/world/sim/engine";
import type { LocationManifest } from "@/world/locations/schema";
import activities from "@content/world/activities.json";
import study from "@content/locations/study.json";
import awayLines from "@content/world/away-lines.json";
import type { AwayLines } from "@/world/sim/away";
import { SimRuntime, type StartResult } from "./simRuntime";

const CTX = { defs: activities as unknown as ActivitiesDoc, nav: buildNav(study as unknown as LocationManifest) };

/** Runs Mio's life simulation while enabled. Returns the current snapshot (null until loaded / when disabled). */
/** `?simSpeed=60` fast-forwards (demo only): runs from now at N× speed and never saves. */
function demoClock(): { now: () => number; persist: boolean } {
  const speed = Math.min(600, Math.max(1, Number(new URLSearchParams(location.search).get("simSpeed")) || 1));
  if (speed === 1) return { now: () => Date.now(), persist: true };
  const t0 = Date.now();
  return { now: () => t0 + (Date.now() - t0) * speed, persist: false };
}

/** `focusUntil`: end time of the user's running Pomodoro focus phase (null when not focusing) — Focus Together. */
export function useLivingWorld(enabled: boolean, focusUntil: number | null = null): { snap: SimSnapshot | null; start: StartResult | null; now: () => number } {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [start, setStart] = useState<StartResult | null>(null);
  const [clock, setClock] = useState<() => number>(() => () => Date.now());
  const rtRef = useRef<SimRuntime | null>(null);
  const focusRef = useRef(focusUntil); focusRef.current = focusUntil;
  useEffect(() => {
    if (!enabled) { setSnap(null); return; }
    const demo = demoClock();
    setClock(() => demo.now);
    const rt = new SimRuntime({
      storage: idbStorage, ctx: CTX, now: demo.now, persist: demo.persist, awayLines: awayLines as AwayLines, tzOffsetMin: () => new Date().getTimezoneOffset(),
      newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] | 0,
    });
    let stopped = false, unsub = () => {};
    rt.start().then((r) => { if (stopped) return; rtRef.current = rt; setStart(r); unsub = rt.subscribe(setSnap); rt.setUserFocus(focusRef.current); }).catch((e) => console.warn("[world] simulation unavailable", e));
    const tick = setInterval(() => rt.tick(), 1000);
    const autosave = setInterval(() => void rt.save(), 30_000);
    const onVisibility = () => { if (document.visibilityState === "hidden") void rt.save(); else rt.tick(); };
    const onHide = () => void rt.save();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      stopped = true; rtRef.current = null; unsub(); clearInterval(tick); clearInterval(autosave);
      document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("pagehide", onHide);
      void rt.save();
    };
  }, [enabled]);
  // Focus Together: tell the simulation when a focus session starts/stops (timer data itself is never modified)
  useEffect(() => { rtRef.current?.setUserFocus(focusUntil); }, [focusUntil]);
  return { snap, start, now: clock };
}
