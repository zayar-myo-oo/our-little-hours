// "While you were away": a short, kind summary built ONLY from events the simulation actually recorded.
import type { ActivityId, SimEvent } from "./engine";

export interface AwayLines { title: string; intro: string; lines: Record<ActivityId, string> }
export interface AwayHighlight { activity: ActivityId; minutes: number; times: number; text: string }
export interface AwaySummary { from: number; to: number; awayMs: number; highlights: AwayHighlight[] }

export const MIN_AWAY_MS = 30 * 60_000;
const MIN_MINUTES = 5;

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(5, Math.round(minutes / 5) * 5)} minutes`;
  const h = Math.round((minutes / 60) * 2) / 2;
  return h === 1 ? "about an hour" : `about ${h} hours`;
}
export const formatTimes = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/**
 * Up to 4 highlights from activities completed in (from, to]. Returns null if the absence was short or there
 * isn't enough to say (fewer than 2 meaningful highlights) — better no card than a padded one.
 */
export function summarizeAway(events: SimEvent[], from: number, to: number, lines: AwayLines): AwaySummary | null {
  if (to - from < MIN_AWAY_MS) return null;
  const by = new Map<ActivityId, { minutes: number; times: number }>();
  for (const e of events) {
    if (e.kind !== "activity" || e.at <= from || e.at > to) continue;
    const g = by.get(e.activity) ?? { minutes: 0, times: 0 };
    g.minutes += e.minutes; g.times += 1; by.set(e.activity, g);
  }
  const highlights = [...by.entries()]
    .filter(([id, g]) => g.minutes >= MIN_MINUTES || (id === "tea" && g.times >= 1))
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 4)
    .map(([activity, g]) => ({
      activity, minutes: g.minutes, times: g.times,
      text: lines.lines[activity].replace("{duration}", formatDuration(g.minutes)).replace("{times}", formatTimes(g.times)),
    }));
  return highlights.length >= 2 ? { from, to, awayMs: to - from, highlights } : null;
}
