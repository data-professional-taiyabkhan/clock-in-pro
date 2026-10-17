import { format } from "date-fns";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { Skeleton } from "@/components/ui/skeleton";
import { fullName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAttendance, useEmployees } from "./use-admin-data";
import { keyToDate } from "@/lib/dates";

export function hoursBetween(a: string | Date, b?: string | Date | null) {
  if (!b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round((ms / 36e5) * 100) / 100);
}

export function scheduleTone(status?: string | null) {
  switch (status) {
    case "late":
      return "bg-warning/15 text-warning";
    case "on_time":
      return "bg-success/10 text-success";
    case "no_show":
      return "bg-destructive/10 text-destructive";
    case "unscheduled":
      return "bg-info/10 text-info";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function AttendanceTab() {
  const { data: records = [], isLoading } = useAttendance();
  const { data: employees = [] } = useEmployees();
  const byId = new Map(employees.map((e) => [e.id, e]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Attendance
        </CardTitle>
        <CardDescription>Most recent clock-ins, compared with each person's scheduled shift.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : records.length === 0 ? (
          <EmptyState icon={<Clock />} title="No attendance yet" description="Clock-ins will appear here as soon as staff start using the app." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.slice(0, 50).map((r: any) => {
                  const emp = byId.get(r.userId);
                  const hrs = hoursBetween(r.clockInTime, r.clockOutTime);
                  const sch = r.schedule;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <AvatarInitials name={fullName(emp) || "?"} className="h-8 w-8" />
                          <span className="font-medium">{fullName(emp) || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{format(keyToDate(r.date), "EEE d MMM")}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {sch?.scheduledStart ? `${format(new Date(sch.scheduledStart), "HH:mm")}–${format(new Date(sch.scheduledEnd), "HH:mm")}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{format(new Date(r.clockInTime), "HH:mm")}</TableCell>
                      <TableCell className="tabular-nums">{r.clockOutTime ? format(new Date(r.clockOutTime), "HH:mm") : <span className="text-success">On shift</span>}</TableCell>
                      <TableCell className="tabular-nums">{hrs != null ? `${hrs}h` : "—"}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", scheduleTone(sch?.status))}>
                          {sch ? sch.label : "Unscheduled"}
                          {sch?.leftEarlyMinutes > 0 && ` · left ${sch.leftEarlyMinutes}m early`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.checkInMethod || "face"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
