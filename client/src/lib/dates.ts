/** Small date-key helpers (YYYY-MM-DD) for the rota UI. Server responses carry the authoritative "today". */
const pad = (n: number) => String(n).padStart(2, "0");

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function startOfWeek(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday-first order of weekday indexes. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function weekdayOf(key: string): number {
  return keyToDate(key).getDay();
}

export function fmtTimeRange(start: string, end: string) {
  return `${start}–${end}`;
}

export function minutesToHours(min: number) {
  return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}`;
}
