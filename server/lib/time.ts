/**
 * Timezone helpers. Attendance "date" keys and shift times are expressed in the
 * organisation's timezone (default Europe/London); timestamps are stored in UTC.
 */
import { storage } from "../storage";

export const DEFAULT_TZ = "Europe/London";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0-6, Sunday = 0
}

export function localParts(date: Date, tz = DEFAULT_TZ): LocalParts {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a timestamp in the given timezone. */
export function localDateKey(date: Date, tz = DEFAULT_TZ): string {
  const p = localParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:MM" for a timestamp in the given timezone. */
export function localTimeHHMM(date: Date, tz = DEFAULT_TZ): string {
  const p = localParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function localWeekday(date: Date, tz = DEFAULT_TZ): number {
  return localParts(date, tz).weekday;
}

/** Offset (ms) of tz from UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time ("YYYY-MM-DD" + "HH:MM") in tz to a UTC Date, DST-safe. */
export function zonedTimeToUtc(dateKey: string, hhmm: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  let utc = guess - tzOffsetMs(new Date(guess), tz);
  // Second pass handles the case where the first guess straddled a DST change
  utc = guess - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + days);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Monday of the week containing dateKey. */
export function startOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  return addDays(dateKey, wd === 0 ? -6 : 1 - wd);
}

export function isValidDateKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Timezone for an organisation (falls back to the default). */
export async function orgTimezone(orgId: number | null | undefined): Promise<string> {
  if (!orgId) return DEFAULT_TZ;
  const org = await storage.getOrganization(orgId);
  return org?.timezone || DEFAULT_TZ;
}

/** Today's date key in the organisation's timezone. */
export async function todayKeyForOrg(orgId: number | null | undefined): Promise<string> {
  return localDateKey(new Date(), await orgTimezone(orgId));
}
