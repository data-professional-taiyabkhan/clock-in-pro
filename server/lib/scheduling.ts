/**
 * Rota resolution and lateness evaluation. Pure functions: no DB access.
 *
 * A "contract" is a set of weekly shift templates (one per weekday). A "shift"
 * row for a specific date overrides the contract for that date (or cancels it).
 */
import type { AttendanceRecord, Shift, ShiftTemplate } from "@shared/schema";
import { dateRange, localWeekday, zonedTimeToUtc, DEFAULT_TZ } from "./time";

export interface ResolvedShift {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  locationId: number | null;
  source: "contract" | "shift";
  status: "scheduled" | "cancelled";
  shiftId?: number;
  templateId?: number;
  notes?: string | null;
  /** UTC instants */
  startsAt: string;
  endsAt: string;
  overnight: boolean;
}

export type AttendanceStatus = "upcoming" | "on_time" | "late" | "no_show" | "unscheduled";

export interface ShiftEvaluation {
  status: AttendanceStatus;
  lateMinutes: number;
  leftEarlyMinutes: number;
  onShiftNow: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  workedMinutes: number;
}

export interface DayCell {
  shift: ResolvedShift | null;
  evaluation: ShiftEvaluation | null;
  records: AttendanceRecord[];
}

function templateApplies(t: ShiftTemplate, date: string): boolean {
  if (t.effectiveFrom && date < t.effectiveFrom) return false;
  if (t.effectiveTo && date > t.effectiveTo) return false;
  return true;
}

/** Build the UTC start/end for a shift on a date; end <= start means it finishes the next day. */
export function shiftInstants(date: string, startTime: string, endTime: string, tz: string) {
  const startsAt = zonedTimeToUtc(date, startTime, tz);
  let endsAt = zonedTimeToUtc(date, endTime, tz);
  const overnight = endsAt.getTime() <= startsAt.getTime();
  if (overnight) endsAt = new Date(endsAt.getTime() + 24 * 3600 * 1000);
  return { startsAt, endsAt, overnight };
}

/** The shift for one user on one date, considering overrides first, then the contract. */
export function resolveShift(userId: number, date: string, templates: ShiftTemplate[], overrides: Shift[], tz: string): ResolvedShift | null {
  const override = overrides.find((s) => s.userId === userId && s.date === date);
  if (override) {
    const { startsAt, endsAt, overnight } = shiftInstants(date, override.startTime, override.endTime, tz);
    return {
      userId,
      date,
      startTime: override.startTime,
      endTime: override.endTime,
      locationId: override.locationId ?? null,
      source: "shift",
      status: override.status === "cancelled" ? "cancelled" : "scheduled",
      shiftId: override.id,
      notes: override.notes ?? null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      overnight,
    };
  }
  const weekday = localWeekday(zonedTimeToUtc(date, "12:00", tz), tz);
  const template = templates.find((t) => t.userId === userId && t.dayOfWeek === weekday && templateApplies(t, date));
  if (!template) return null;
  const { startsAt, endsAt, overnight } = shiftInstants(date, template.startTime, template.endTime, tz);
  return {
    userId,
    date,
    startTime: template.startTime,
    endTime: template.endTime,
    locationId: template.locationId ?? null,
    source: "contract",
    status: "scheduled",
    templateId: template.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    overnight,
  };
}

/** Compare attendance records for a date against the scheduled shift. */
export function evaluateShift(shift: ResolvedShift | null, records: AttendanceRecord[], graceMinutes: number, now = new Date()): ShiftEvaluation | null {
  const sorted = [...records].sort((a, b) => new Date(a.clockInTime).getTime() - new Date(b.clockInTime).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const workedMinutes = sorted.reduce((sum, r) => {
    const end = r.clockOutTime ? new Date(r.clockOutTime).getTime() : Math.min(now.getTime(), new Date(r.clockInTime).getTime() + 14 * 3600 * 1000);
    return sum + Math.max(0, Math.round((end - new Date(r.clockInTime).getTime()) / 60000));
  }, 0);
  const onShiftNow = !!last && !last.clockOutTime && now.getTime() - new Date(last.clockInTime).getTime() < 14 * 3600 * 1000;
  const base = {
    lateMinutes: 0,
    leftEarlyMinutes: 0,
    onShiftNow,
    clockInAt: first ? new Date(first.clockInTime).toISOString() : null,
    clockOutAt: last?.clockOutTime ? new Date(last.clockOutTime).toISOString() : null,
    workedMinutes,
  };

  if (!shift || shift.status === "cancelled") {
    return sorted.length ? { ...base, status: "unscheduled" } : null;
  }

  const start = new Date(shift.startsAt).getTime();
  const end = new Date(shift.endsAt).getTime();
  const graceMs = graceMinutes * 60000;

  if (!first) {
    return { ...base, status: now.getTime() > start + graceMs ? "no_show" : "upcoming" };
  }

  const firstIn = new Date(first.clockInTime).getTime();
  const lateMinutes = firstIn > start + graceMs ? Math.round((firstIn - start) / 60000) : 0;
  let leftEarlyMinutes = 0;
  if (last?.clockOutTime) {
    const out = new Date(last.clockOutTime).getTime();
    if (out < end - graceMs) leftEarlyMinutes = Math.round((end - out) / 60000);
  }
  return { ...base, status: lateMinutes > 0 ? "late" : "on_time", lateMinutes, leftEarlyMinutes };
}

export interface RotaInput {
  userIds: number[];
  from: string;
  to: string;
  templates: ShiftTemplate[];
  overrides: Shift[];
  records: AttendanceRecord[];
  graceMinutes: number;
  tz?: string;
  now?: Date;
}

/** Resolve every (user, date) cell for the rota grid. */
export function buildRota(input: RotaInput): Record<number, Record<string, DayCell>> {
  const tz = input.tz ?? DEFAULT_TZ;
  const now = input.now ?? new Date();
  const dates = dateRange(input.from, input.to);
  const recordsByKey = new Map<string, AttendanceRecord[]>();
  for (const r of input.records) {
    const k = `${r.userId}|${r.date}`;
    recordsByKey.set(k, [...(recordsByKey.get(k) ?? []), r]);
  }
  const out: Record<number, Record<string, DayCell>> = {};
  for (const userId of input.userIds) {
    out[userId] = {};
    for (const date of dates) {
      const shift = resolveShift(userId, date, input.templates, input.overrides, tz);
      const records = recordsByKey.get(`${userId}|${date}`) ?? [];
      out[userId][date] = { shift, evaluation: evaluateShift(shift, records, input.graceMinutes, now), records };
    }
  }
  return out;
}

/** Human-readable summary for shift chips. */
export function statusLabel(e: ShiftEvaluation | null, shift: ResolvedShift | null): string {
  if (shift?.status === "cancelled") return "Cancelled";
  if (!e) return shift ? "Scheduled" : "—";
  switch (e.status) {
    case "late":
      return `Late +${e.lateMinutes}m`;
    case "on_time":
      return e.onShiftNow ? "On shift" : "On time";
    case "no_show":
      return "No-show";
    case "upcoming":
      return "Scheduled";
    case "unscheduled":
      return e.onShiftNow ? "On shift (unscheduled)" : "Worked (unscheduled)";
  }
}

export interface ScheduleAnnotation {
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  leftEarlyMinutes: number;
  label: string;
}

/** Attach the scheduled shift and lateness verdict to each attendance record (grouped per user+date). */
export function annotateRecords<T extends AttendanceRecord>(records: T[], templates: ShiftTemplate[], overrides: Shift[], graceMinutes: number, tz = DEFAULT_TZ, now = new Date()): (T & { schedule: ScheduleAnnotation | null })[] {
  const byKey = new Map<string, T[]>();
  for (const r of records) {
    const k = `${r.userId}|${r.date}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const cache = new Map<string, ScheduleAnnotation | null>();
  return records.map((r) => {
    const k = `${r.userId}|${r.date}`;
    if (!cache.has(k)) {
      const shift = resolveShift(r.userId, r.date, templates, overrides, tz);
      const evaluation = evaluateShift(shift, byKey.get(k) ?? [], graceMinutes, now);
      cache.set(
        k,
        shift || evaluation
          ? {
              scheduledStart: shift && shift.status !== "cancelled" ? shift.startsAt : null,
              scheduledEnd: shift && shift.status !== "cancelled" ? shift.endsAt : null,
              status: evaluation?.status ?? "upcoming",
              lateMinutes: evaluation?.lateMinutes ?? 0,
              leftEarlyMinutes: evaluation?.leftEarlyMinutes ?? 0,
              label: statusLabel(evaluation, shift),
            }
          : null
      );
    }
    return { ...r, schedule: cache.get(k) ?? null };
  });
}
