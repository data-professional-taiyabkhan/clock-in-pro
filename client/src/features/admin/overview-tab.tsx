import { format } from "date-fns";
import { AlertTriangle, Building2, CalendarClock, Clock, ScanFace, UserX, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEmployees, useLocations } from "./use-admin-data";
import { statusTone, useTodaySummary, type TodayRow } from "./schedule-api";

const hhmm = (iso?: string | null) => (iso ? format(new Date(iso), "HH:mm") : "—");

export function OverviewTab() {
  const { data: employees = [] } = useEmployees();
  const { data: locations = [] } = useLocations();
  const { data: today, isLoading } = useTodaySummary();
  const staff = employees.filter((e) => e.role === "employee" && e.isActive);
  const faceReady = staff.filter((e) => e.faceRegistered).length;

  if (isLoading || !today) return <Skeleton className="h-72 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Scheduled today" value={today.counts.scheduled} hint={`of ${today.counts.employees} active employees`} icon={<CalendarClock />} tone="primary" />
        <StatCard label="On shift now" value={today.counts.onShift} hint={`${today.counts.upcoming} still to come`} icon={<Clock />} tone="success" />
        <StatCard label="Late today" value={today.counts.late} hint={`Grace period ${today.graceMinutes} min`} icon={<AlertTriangle />} tone={today.counts.late ? "warning" : "default"} />
        <StatCard label="No-shows" value={today.counts.noShow} hint="Past start, not clocked in" icon={<UserX />} tone={today.counts.noShow ? "destructive" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PeopleCard
          title="Needs attention"
          description="Late arrivals and people who haven't turned up"
          rows={[...today.late, ...today.noShows]}
          empty="Everyone scheduled so far is in on time."
          emptyIcon={<AlertTriangle />}
          detail={(r) =>
            r.evaluation?.status === "late"
              ? `Due ${r.shift ? r.shift.startTime : ""} · in at ${hhmm(r.evaluation.clockInAt)}`
              : `Due ${r.shift ? r.shift.startTime : ""} · not clocked in`
          }
        />
        <PeopleCard
          title="On shift now"
          description="Open clock-ins right now"
          rows={[...today.onShift, ...today.unscheduled.filter((r) => r.evaluation?.onShiftNow && !today.onShift.some((o) => o.user.id === r.user.id))]}
          empty="Nobody is clocked in at the moment."
          emptyIcon={<Clock />}
          detail={(r) => `Since ${hhmm(r.evaluation?.clockInAt)}${r.shift ? ` · shift ${r.shift.startTime}–${r.shift.endTime}` : " · no shift scheduled"}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <PeopleCard
          title="Still to come today"
          description="Scheduled, not yet due"
          rows={today.upcoming}
          empty="No more shifts starting today."
          emptyIcon={<CalendarClock />}
          detail={(r) => (r.shift ? `${r.shift.startTime}–${r.shift.endTime}` : "")}
          compact
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard label="Face registered" value={`${faceReady}/${staff.length}`} hint="Others can use a PIN" icon={<ScanFace />} tone="info" />
          <StatCard label="Locations" value={locations.length} hint={locations.length ? "Geofencing on" : "Clock in from anywhere"} icon={<Building2 />} />
          <StatCard label="Active employees" value={staff.length} hint="Billed seats" icon={<Users />} className="sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    </div>
  );
}

function PeopleCard({ title, description, rows, empty, emptyIcon, detail, compact }: { title: string; description: string; rows: TodayRow[]; empty: string; emptyIcon: React.ReactNode; detail: (r: TodayRow) => string; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className={cn(compact && "pb-3")}>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={emptyIcon} title={empty} className="py-6" />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.user.id} className="flex items-center gap-3 py-2.5">
                <AvatarInitials name={`${r.user.firstName} ${r.user.lastName}`} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.user.firstName} {r.user.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{detail(r)}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusTone(r))}>{r.label}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
