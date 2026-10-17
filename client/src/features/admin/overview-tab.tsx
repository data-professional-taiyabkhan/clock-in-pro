import { format } from "date-fns";
import { Building2, Clock, ScanFace, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { EmptyState } from "@/components/ui/empty-state";
import { fullName } from "@/lib/types";
import { useAttendance, useEmployees, useLocations } from "./use-admin-data";

export function OverviewTab() {
  const { data: employees = [] } = useEmployees();
  const { data: locations = [] } = useLocations();
  const { data: records = [] } = useAttendance();
  const staff = employees.filter((e) => e.role === "employee" && e.isActive);
  const faceReady = staff.filter((e) => e.faceRegistered).length;
  const byId = new Map(employees.map((e) => [e.id, e]));
  const onShift = records.filter((r) => !r.clockOutTime && Date.now() - new Date(r.clockInTime).getTime() < 14 * 36e5);
  const today = format(new Date(), "yyyy-MM-dd");
  const todays = records.filter((r) => r.date === today);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active employees" value={staff.length} hint="Billed seats" icon={<Users />} tone="primary" />
        <StatCard label="On shift now" value={onShift.length} hint={`${todays.length} clock-in${todays.length === 1 ? "" : "s"} today`} icon={<Clock />} tone="success" />
        <StatCard label="Face registered" value={`${faceReady}/${staff.length || 0}`} hint="Others can use a PIN" icon={<ScanFace />} tone="info" />
        <StatCard label="Locations" value={locations.length} hint={locations.length ? "Geofencing on" : "Clock in from anywhere"} icon={<Building2 />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Who's in right now</CardTitle>
          <CardDescription>Open clock-ins. Staff forgotten on shift are closed automatically after 14 hours.</CardDescription>
        </CardHeader>
        <CardContent>
          {onShift.length === 0 ? (
            <EmptyState icon={<Clock />} title="Nobody is clocked in" description="Clock-ins show here in real time." className="py-8" />
          ) : (
            <ul className="divide-y divide-border">
              {onShift.map((r) => {
                const emp = byId.get(r.userId);
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <AvatarInitials name={fullName(emp) || "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{fullName(emp) || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Since {format(new Date(r.clockInTime), "HH:mm")} · {r.checkInMethod}</p>
                    </div>
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">On shift</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
