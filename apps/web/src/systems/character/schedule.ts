// Character daily schedule simulation (local time).
export type Availability = "AVAILABLE" | "BUSY" | "SLEEPING";
export interface ScheduleBlock { start: number; end: number; state: Availability; activity: string } // minutes from midnight

export const DEFAULT_SCHEDULE: ScheduleBlock[] = [
  { start: 0, end: 7 * 60, state: "SLEEPING", activity: "Sleeping" },
  { start: 7 * 60, end: 8 * 60, state: "BUSY", activity: "Making breakfast" },
  { start: 8 * 60, end: 12 * 60, state: "AVAILABLE", activity: "Studying at the desk" },
  { start: 12 * 60, end: 13 * 60, state: "BUSY", activity: "Lunch break" },
  { start: 13 * 60, end: 18 * 60, state: "AVAILABLE", activity: "Writing in her notebook" },
  { start: 18 * 60, end: 19 * 60 + 30, state: "BUSY", activity: "Out for groceries" },
  { start: 19 * 60 + 30, end: 23 * 60 + 30, state: "AVAILABLE", activity: "Reading by lamplight" },
  { start: 23 * 60 + 30, end: 24 * 60, state: "SLEEPING", activity: "Sleeping" },
];

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function currentBlock(d: Date, schedule = DEFAULT_SCHEDULE): ScheduleBlock {
  const m = minutesOfDay(d);
  return schedule.find((b) => m >= b.start && m < b.end) ?? schedule[0];
}

export function nextChange(d: Date, schedule = DEFAULT_SCHEDULE): ScheduleBlock {
  const cur = currentBlock(d, schedule);
  const i = schedule.indexOf(cur);
  for (let k = 1; k <= schedule.length; k++) {
    const b = schedule[(i + k) % schedule.length];
    if (b.state !== cur.state) return b;
  }
  return cur;
}

export const fmtMinutes = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
