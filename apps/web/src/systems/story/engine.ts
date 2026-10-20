// Minimal branching visual-novel engine driven by JSON content.
export interface Choice { text: string; next: string; flag?: string }
export interface StoryNode { id: string; speaker?: string; text: string; mood?: string; next?: string; choices?: Choice[]; end?: boolean }
export interface Story { id: string; title: string; start: string; nodes: Record<string, StoryNode> }
export interface StoryProgress { storyId: string; nodeId: string; flags: string[]; completed: boolean; seen: string[] }

export function validateStory(s: Story): string[] {
  const errs: string[] = [];
  if (!s.nodes[s.start]) errs.push(`missing start node ${s.start}`);
  for (const n of Object.values(s.nodes)) {
    const targets = [n.next, ...(n.choices ?? []).map((c) => c.next)].filter(Boolean) as string[];
    for (const t of targets) if (!s.nodes[t]) errs.push(`${n.id} -> missing ${t}`);
    if (!n.end && targets.length === 0) errs.push(`${n.id} is a dead end`);
  }
  return errs;
}

export const begin = (s: Story): StoryProgress => ({ storyId: s.id, nodeId: s.start, flags: [], completed: false, seen: [s.start] });

export function advance(s: Story, p: StoryProgress, choiceIndex?: number): StoryProgress {
  const node = s.nodes[p.nodeId];
  if (!node || node.end) return { ...p, completed: true };
  let target = node.next;
  const flags = [...p.flags];
  if (node.choices?.length) {
    const c = node.choices[choiceIndex ?? -1];
    if (!c) return p; // a choice is required
    target = c.next;
    if (c.flag && !flags.includes(c.flag)) flags.push(c.flag);
  }
  if (!target || !s.nodes[target]) return p;
  return { ...p, nodeId: target, flags, completed: !!s.nodes[target].end, seen: p.seen.includes(target) ? p.seen : [...p.seen, target] };
}

/** Replace {flag:name|yes|no} tokens using story flags. */
export const renderText = (text: string, flags: string[]) =>
  text.replace(/\{flag:([\w-]+)\|([^|}]*)\|([^}]*)\}/g, (_, f, a, b) => (flags.includes(f) ? a : b));
