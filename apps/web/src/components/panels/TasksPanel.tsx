"use client";
import { useState, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectTasks } from "@/store/selectors";
import { useGame } from "@/store/useGame";
import { progress } from "@/systems/productivity/tasks";
import { Btn, Panel } from "./ui";

function TasksPanelView() {
  const { tasks, taskAction } = useGame(useShallow(selectTasks));
  const [text, setText] = useState("");
  const p = progress(tasks);
  return (
    <Panel title={`Tasks · ${p.done}/${p.total}`}>
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); taskAction({ type: "add", title: text }); setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Something small…" maxLength={200} aria-label="New task"
          className="flex-1 rounded-full bg-cream/10 px-4 py-2 text-sm placeholder:text-cream/40" />
        <Btn type="submit" disabled={!text.trim()}>Add</Btn>
      </form>
      {tasks.length === 0 && <p className="text-sm opacity-60">No tasks yet. The page is yours.</p>}
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-cream/5">
            <input type="checkbox" checked={t.done} onChange={() => taskAction({ type: "toggle", id: t.id })} className="accent-amber-300" aria-label={`Done: ${t.title}`} />
            <span className={`flex-1 text-sm ${t.done ? "line-through opacity-50" : ""}`}
              onDoubleClick={() => { const v = prompt("Edit task", t.title); if (v !== null) taskAction({ type: "edit", id: t.id, title: v }); }}>{t.title}</span>
            <button onClick={() => taskAction({ type: "remove", id: t.id })} className="text-xs opacity-50 hover:opacity-100" aria-label={`Delete ${t.title}`}>✕</button>
          </li>
        ))}
      </ul>
      {p.done > 0 && <Btn className="mt-3" onClick={() => taskAction({ type: "clearDone" })}>Clear completed</Btn>}
      <p className="mt-2 text-xs opacity-50">Double-click a task to edit.</p>
    </Panel>
  );
}

export const TasksPanel = memo(TasksPanelView);
