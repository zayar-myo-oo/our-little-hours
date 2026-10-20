export interface Task { id: string; title: string; done: boolean; createdAt: number }

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function addTask(tasks: Task[], title: string, now = Date.now()): Task[] {
  const t = title.trim().slice(0, 200);
  if (!t) return tasks;
  return [...tasks, { id: uid(), title: t, done: false, createdAt: now }];
}
export const toggleTask = (tasks: Task[], id: string) => tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
export const removeTask = (tasks: Task[], id: string) => tasks.filter((t) => t.id !== id);
export const editTask = (tasks: Task[], id: string, title: string) =>
  title.trim() ? tasks.map((t) => (t.id === id ? { ...t, title: title.trim().slice(0, 200) } : t)) : tasks;
export const clearDone = (tasks: Task[]) => tasks.filter((t) => !t.done);
export const progress = (tasks: Task[]) => ({ done: tasks.filter((t) => t.done).length, total: tasks.length });
