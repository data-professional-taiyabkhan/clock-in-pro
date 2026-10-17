import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type AttendanceStatus = "upcoming" | "on_time" | "late" | "no_show" | "unscheduled";

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
  startsAt: string;
  endsAt: string;
  overnight: boolean;
}

export interface ShiftEvaluation {
  status: AttendanceStatus;
  lateMinutes: number;
  leftEarlyMinutes: number;
  onShiftNow: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  workedMinutes: number;
}

export interface RotaCell {
  shift: ResolvedShift | null;
  evaluation: ShiftEvaluation | null;
  label: string;
}

export interface RotaEmployee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  hasContract: boolean;
  days: Record<string, RotaCell>;
}

export interface RotaResponse {
  from: string;
  to: string;
  today: string;
  timezone: string;
  graceMinutes: number;
  days: string[];
  employees: RotaEmployee[];
}

export interface ContractDay {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationId: number | null;
}

export interface Contract {
  days: ContractDay[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface TodayRow extends RotaCell {
  user: { id: number; firstName: string; lastName: string; email: string };
}

export interface TodaySummary {
  date: string;
  timezone: string;
  graceMinutes: number;
  counts: { employees: number; scheduled: number; onShift: number; late: number; noShow: number; upcoming: number };
  late: TodayRow[];
  noShows: TodayRow[];
  onShift: TodayRow[];
  upcoming: TodayRow[];
  unscheduled: TodayRow[];
}

export interface MyShiftsResponse {
  from: string;
  to: string;
  today: string;
  graceMinutes: number;
  hasContract: boolean;
  days: (RotaCell & { date: string })[];
}

export const useRota = (from: string, to: string) =>
  useQuery<RotaResponse>({ queryKey: ["/api/rota", from, to], queryFn: () => apiRequest(`/api/rota?from=${from}&to=${to}`) });

export const useContracts = () =>
  useQuery<{ contracts: Record<number, Contract> }>({ queryKey: ["/api/schedules/contracts"], queryFn: () => apiRequest("/api/schedules/contracts") });

export const useTodaySummary = () =>
  useQuery<TodaySummary>({ queryKey: ["/api/dashboard/today"], queryFn: () => apiRequest("/api/dashboard/today"), refetchInterval: 60_000 });

export const useMyShifts = (from: string, to: string) =>
  useQuery<MyShiftsResponse>({ queryKey: ["/api/my-shifts", from, to], queryFn: () => apiRequest(`/api/my-shifts?from=${from}&to=${to}`) });

/** Tailwind classes for a status chip. */
export function statusTone(cell: RotaCell | null | undefined): string {
  if (!cell?.shift && !cell?.evaluation) return "bg-muted text-muted-foreground";
  if (cell.shift?.status === "cancelled") return "bg-muted text-muted-foreground line-through";
  switch (cell.evaluation?.status) {
    case "late":
      return "bg-warning/15 text-warning";
    case "no_show":
      return "bg-destructive/10 text-destructive";
    case "on_time":
      return "bg-success/10 text-success";
    case "unscheduled":
      return "bg-info/10 text-info";
    default:
      return "bg-primary/10 text-primary";
  }
}
