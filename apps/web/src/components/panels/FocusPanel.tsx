"use client";
import { memo } from "react";
import { useNow } from "@/lib/useNow";
import { useShallow } from "zustand/react/shallow";
import { selectFocus } from "@/store/selectors";
import { useGame } from "@/store/useGame";
import { formatMs, remaining, type Phase } from "@/systems/productivity/pomodoro";
import { Btn, Panel } from "./ui";

const LABEL: Record<Phase, string> = { focus: "Focus", shortBreak: "Short break", longBreak: "Long break" };

function FocusPanelView() {
  const now = useNow(500);
  const { timer, config, timerAction, setConfig } = useGame(useShallow(selectFocus));
  return (
    <Panel title="Focus">
      <div className="mb-3 flex gap-2">
        {(Object.keys(LABEL) as Phase[]).map((p) => (
          <Btn key={p} onClick={() => timerAction(p)} className={timer.phase === p ? "!bg-amber-glow/30" : ""} aria-pressed={timer.phase === p}>{LABEL[p]}</Btn>
        ))}
      </div>
      <p className="my-4 text-center font-serif text-6xl tabular-nums" aria-live="polite">{formatMs(remaining(timer, now))}</p>
      <div className="flex justify-center gap-3">
        {timer.running ? <Btn onClick={() => timerAction("pause")}>Pause</Btn> : <Btn onClick={() => timerAction("start")}>Start</Btn>}
        <Btn onClick={() => timerAction("reset")}>Reset</Btn>
      </div>
      <p className="mt-4 text-center text-xs opacity-70">Completed focus sessions: {timer.completedFocus}</p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer opacity-80">Durations (minutes)</summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([["focusMin", "Focus"], ["shortBreakMin", "Short"], ["longBreakMin", "Long"]] as const).map(([k, l]) => (
            <label key={k} className="text-xs">{l}
              <input type="number" min={1} max={180} value={config[k]} onChange={(e) => setConfig({ [k]: Math.max(1, Math.min(180, Number(e.target.value) || 1)) })}
                className="mt-1 w-full rounded-lg bg-cream/10 px-2 py-1" />
            </label>
          ))}
        </div>
      </details>
    </Panel>
  );
}

export const FocusPanel = memo(FocusPanelView);
