// Calendar helpers on epoch milliseconds with an explicit timezone offset (no reading of the clock here).
const DAY = 86_400_000;
/** tzOffsetMin follows Date#getTimezoneOffset (minutes to ADD to local time to get UTC). */
export function localParts(ms: number, tzOffsetMin: number) {
  const local = ms - tzOffsetMin * 60_000;
  const days = Math.floor(local / DAY);
  const minuteOfDay = Math.floor((local - days * DAY) / 60_000);
  const dow = (((days + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday; 0 = Sunday
  return { minuteOfDay, dow, weekend: dow === 0 || dow === 6 };
}
export const parseHM = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
/** Is minute-of-day inside [from, to) where the window may wrap past midnight. */
export function inWindow(minute: number, from: number, to: number) { return from <= to ? minute >= from && minute < to : minute >= from || minute < to; }
/** Milliseconds from `ms` until the local minute-of-day `target` next occurs (0 < result ≤ 1 day). */
export function msUntilMinute(ms: number, tzOffsetMin: number, target: number) {
  const local = ms - tzOffsetMin * 60_000;
  const minuteMs = local - Math.floor(local / DAY) * DAY;
  let d = target * 60_000 - minuteMs;
  if (d <= 0) d += DAY;
  return d;
}
