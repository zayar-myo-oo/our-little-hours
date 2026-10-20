// Pause/resume helper for render loops. Only rendering is paused: game logic (Pomodoro) uses wall-clock
// timestamps, so it stays correct while hidden.
type DocLike = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

export interface PausableLoop { pause(): void; resume(): void }

/** Calls loop.pause() when the page becomes hidden and loop.resume() when visible again. Returns a disposer. */
export function pauseWhenHidden(loop: PausableLoop, doc: DocLike | undefined = typeof document !== "undefined" ? document : undefined): () => void {
  if (!doc) return () => {};
  let paused = false;
  const sync = () => {
    const hidden = doc.visibilityState === "hidden";
    if (hidden && !paused) { paused = true; loop.pause(); }
    else if (!hidden && paused) { paused = false; loop.resume(); }
  };
  doc.addEventListener("visibilitychange", sync);
  sync();
  return () => doc.removeEventListener("visibilitychange", sync);
}
