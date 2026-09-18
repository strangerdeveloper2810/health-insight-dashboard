/**
 * Date helpers.
 *
 * Everything in this app speaks `ISODate` (`YYYY-MM-DD`) rather than `Date`,
 * because a health record is a *calendar* day, not an instant. Dates are
 * parsed at local noon so that daylight-saving shifts can never move a
 * record into the neighbouring day.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  // Noon, not midnight: DST transitions happen near midnight in most zones.
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round(
    (parseISODate(to).getTime() - parseISODate(from).getTime()) / MS_PER_DAY,
  );
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: ISODate): number {
  return parseISODate(iso).getDay();
}

export function isWeekend(iso: ISODate): boolean {
  const dow = dayOfWeek(iso);
  return dow === 0 || dow === 6;
}

/** "Sep 12" — compact enough for axis ticks and list rows. */
export function formatShortDate(iso: ISODate): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "Sat 12 Sep" — for tooltips and detail rows. */
export function formatLongDate(iso: ISODate): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * The last `days` dates ending at `end`, oldest first.
 * Returned as a plain array so callers can `map`/`filter` without index math.
 */
export function dateRange(end: ISODate, days: number): ISODate[] {
  const out: ISODate[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(addDays(end, -i));
  return out;
}

/** Minutes since midnight for a local `HH:MM` clock time. */
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Bedtimes straddle midnight (23:10 and 00:40 are 90 minutes apart, not 22
 * hours). Mapping them onto a continuous timeline anchored at 18:00 makes
 * averages, variance and consistency scores behave correctly.
 */
export function bedtimeToTimeline(hhmm: string): number {
  const minutes = clockToMinutes(hhmm);
  return minutes < 12 * 60 ? minutes + 1440 : minutes;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
