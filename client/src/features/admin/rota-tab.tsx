import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cleanError, type Location } from "@/lib/types";
import { addDays, keyToDate, startOfWeek, todayKey, WEEKDAY_LONG, WEEKDAY_SHORT, WEEK_ORDER } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useLocations } from "./use-admin-data";
import { statusTone, useContracts, useRota, type Contract, type RotaCell, type RotaEmployee } from "./schedule-api";

export function RotaTab() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayKey()));
  const weekEnd = addDays(weekStart, 6);
  const { data: rota, isLoading } = useRota(weekStart, weekEnd);
  const { data: contractsData } = useContracts();
  const { data: locations = [] } = useLocations();
  const [contractFor, setContractFor] = useState<RotaEmployee | null>(null);
  const [shiftFor, setShiftFor] = useState<{ employee: RotaEmployee; date: string; cell: RotaCell } | null>(null);

  const title = `${format(keyToDate(weekStart), "d MMM")} – ${format(keyToDate(weekEnd), "d MMM yyyy")}`;
  const isThisWeek = weekStart === startOfWeek(todayKey());

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Rota
          </CardTitle>
          <CardDescription>
            Set each person's weekly contract once; it repeats every week. Click any day to add a one-off shift or cancel it. Lateness uses a {rota?.graceMinutes ?? 5}-minute grace period
            (change it in Settings).
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="min-w-[180px]" onClick={() => setWeekStart(startOfWeek(todayKey()))} disabled={isThisWeek}>
            {isThisWeek ? "This week" : title}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !rota ? (
          <Skeleton className="h-64 w-full" />
        ) : rota.employees.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title="No employees to schedule" description="Add employees first, then set their weekly contracts here." />
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[860px] border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-medium text-muted-foreground">Employee</th>
                  {rota.days.map((d) => {
                    const dt = keyToDate(d);
                    const isToday = d === rota.today;
                    return (
                      <th key={d} className={cn("px-1 py-2 text-center font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                        <div className="text-xs uppercase tracking-wide">{WEEKDAY_SHORT[dt.getDay()]}</div>
                        <div className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm", isToday && "bg-primary text-primary-foreground")}>{dt.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rota.employees.map((emp) => (
                  <tr key={emp.id} className="group">
                    <td className="sticky left-0 z-10 bg-card py-1 pr-3">
                      <div className="flex items-center gap-2">
                        <AvatarInitials name={`${emp.firstName} ${emp.lastName}`} className="h-8 w-8" />
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-tight">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <button type="button" onClick={() => setContractFor(emp)} className="text-xs text-primary hover:underline">
                            {emp.hasContract ? "Edit contract" : "Set contract"}
                          </button>
                        </div>
                      </div>
                    </td>
                    {rota.days.map((d) => {
                      const cell = emp.days[d];
                      const past = d < rota.today;
                      return (
                        <td key={d} className="px-1 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => setShiftFor({ employee: emp, date: d, cell })}
                            className={cn(
                              "flex h-[58px] w-full flex-col items-center justify-center rounded-lg border px-1 text-xs transition-colors hover:border-primary/50",
                              cell.shift ? "border-border bg-background" : "border-dashed border-border/70 text-muted-foreground/60 hover:text-primary",
                              d === rota.today && "ring-1 ring-primary/30"
                            )}
                          >
                            {cell.shift ? (
                              <>
                                <span className={cn("font-medium tabular-nums", cell.shift.status === "cancelled" && "line-through text-muted-foreground")}>
                                  {cell.shift.startTime}–{cell.shift.endTime}
                                </span>
                                <span className={cn("mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", statusTone(cell))}>{cell.label}</span>
                              </>
                            ) : cell.evaluation ? (
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", statusTone(cell))}>{cell.label}</span>
                            ) : (
                              <Plus className={cn("h-4 w-4", past && "opacity-30")} />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend tone="bg-success/10 text-success" label="On time / on shift" />
          <Legend tone="bg-warning/15 text-warning" label="Late" />
          <Legend tone="bg-destructive/10 text-destructive" label="No-show" />
          <Legend tone="bg-primary/10 text-primary" label="Scheduled" />
          <Legend tone="bg-info/10 text-info" label="Worked, unscheduled" />
        </div>
      </CardContent>

      {contractFor && (
        <ContractDialog
          employee={contractFor}
          contract={contractsData?.contracts?.[contractFor.id] ?? null}
          locations={locations}
          onClose={() => setContractFor(null)}
        />
      )}
      {shiftFor && <ShiftDialog employee={shiftFor.employee} date={shiftFor.date} cell={shiftFor.cell} locations={locations} onClose={() => setShiftFor(null)} />}
    </Card>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-full", tone.split(" ")[0])} /> {label}
    </span>
  );
}

type DayForm = { enabled: boolean; startTime: string; endTime: string; locationId: string };

function ContractDialog({ employee, contract, locations, onClose }: { employee: RotaEmployee; contract: Contract | null; locations: Location[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<Record<number, DayForm>>(() => {
    const base: Record<number, DayForm> = {};
    for (const d of WEEK_ORDER) base[d] = { enabled: false, startTime: "09:00", endTime: "17:00", locationId: "" };
    for (const c of contract?.days ?? []) base[c.dayOfWeek] = { enabled: true, startTime: c.startTime, endTime: c.endTime, locationId: c.locationId ? String(c.locationId) : "" };
    return base;
  });
  const [effectiveFrom, setEffectiveFrom] = useState(contract?.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = useState(contract?.effectiveTo ?? "");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/schedules/contracts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rota"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/today"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
  };

  const save = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/schedules/contracts/${employee.id}`, {
        method: "PUT",
        body: {
          days: WEEK_ORDER.filter((d) => days[d].enabled).map((d) => ({ dayOfWeek: d, startTime: days[d].startTime, endTime: days[d].endTime, locationId: days[d].locationId ? Number(days[d].locationId) : null })),
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Contract saved", description: `${employee.firstName}'s weekly contract now repeats every week.` });
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't save contract", description: cleanError(e), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async () => apiRequest(`/api/schedules/contracts/${employee.id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Contract removed" });
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't remove contract", description: cleanError(e), variant: "destructive" }),
  });

  const firstEnabled = WEEK_ORDER.find((d) => days[d].enabled);
  const applyToAll = () => {
    if (firstEnabled == null) return;
    const src = days[firstEnabled];
    setDays((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.enabled ? { ...v, startTime: src.startTime, endTime: src.endTime, locationId: src.locationId } : v])) as Record<number, DayForm>);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Weekly contract · {employee.firstName} {employee.lastName}
          </DialogTitle>
          <DialogDescription>Tick the days they work and set the hours. This repeats every week until you change it. One-off changes go on the rota itself.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {WEEK_ORDER.map((d) => {
            const f = days[d];
            return (
              <div key={d} className={cn("grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg border px-3 py-2 sm:grid-cols-[110px_1fr_1fr_1fr]", f.enabled ? "border-border" : "border-border/60 opacity-70")}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={f.enabled} onCheckedChange={(v) => setDays((p) => ({ ...p, [d]: { ...p[d], enabled: !!v } }))} />
                  {WEEKDAY_LONG[d]}
                </label>
                <div className="col-span-1 grid grid-cols-2 gap-2 sm:col-span-3 sm:grid-cols-3">
                  <Input type="time" value={f.startTime} disabled={!f.enabled} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], startTime: e.target.value } }))} className="h-9" />
                  <Input type="time" value={f.endTime} disabled={!f.enabled} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], endTime: e.target.value } }))} className="h-9" />
                  <Select value={f.locationId || "any"} disabled={!f.enabled} onValueChange={(v) => setDays((p) => ({ ...p, [d]: { ...p[d], locationId: v === "any" ? "" : v } }))}>
                    <SelectTrigger className="col-span-2 h-9 sm:col-span-1">
                      <SelectValue placeholder="Any site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any site</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={applyToAll} disabled={firstEnabled == null}>
            Copy {firstEnabled != null ? WEEKDAY_LONG[firstEnabled] : "first day"}'s hours to all ticked days
          </Button>
          <div className="flex gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Starts (optional)</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ends (optional)</Label>
              <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">An end time earlier than the start time means an overnight shift that finishes the next day.</p>
        <div className="flex justify-between gap-2 pt-2">
          {contract ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Remove contract
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save contract"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShiftDialog({ employee, date, cell, locations, onClose }: { employee: RotaEmployee; date: string; cell: RotaCell; locations: Location[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const existing = cell.shift;
  const [startTime, setStartTime] = useState(existing?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(existing?.endTime ?? "17:00");
  const [locationId, setLocationId] = useState(existing?.locationId ? String(existing.locationId) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const dateLabel = format(keyToDate(date), "EEEE d MMMM");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/rota"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/today"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
  };
  const upsert = useMutation({
    mutationFn: async (status: "scheduled" | "cancelled") =>
      apiRequest("/api/schedules/shifts", {
        method: "POST",
        body: { userId: employee.id, date, startTime, endTime, locationId: locationId ? Number(locationId) : null, notes: notes.trim() || null, status },
      }),
    onSuccess: (_r, status) => {
      invalidate();
      toast({ title: status === "cancelled" ? "Day cancelled" : "Shift saved" });
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't save", description: cleanError(e), variant: "destructive" }),
  });
  const removeOverride = useMutation({
    mutationFn: async () => apiRequest(`/api/schedules/shifts/${existing!.shiftId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Back to the contract", description: "The one-off change was removed." });
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't remove", description: cleanError(e), variant: "destructive" }),
  });

  const e = cell.evaluation;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {employee.firstName} {employee.lastName} · {dateLabel}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? existing.source === "contract"
                ? `From their weekly contract: ${existing.startTime}–${existing.endTime}.`
                : existing.status === "cancelled"
                  ? "This day is cancelled."
                  : `One-off shift: ${existing.startTime}–${existing.endTime}.`
              : "No shift scheduled. Add a one-off shift below."}
          </DialogDescription>
        </DialogHeader>

        {e && (e.clockInAt || e.status === "no_show") && (
          <div className={cn("rounded-lg px-3 py-2 text-sm", statusTone(cell))}>
            <span className="font-medium">{cell.label}</span>
            {e.clockInAt && <span className="ml-2 opacity-80">In {format(new Date(e.clockInAt), "HH:mm")}{e.clockOutAt ? ` · Out ${format(new Date(e.clockOutAt), "HH:mm")}` : ""}</span>}
            {e.leftEarlyMinutes > 0 && <span className="ml-2 opacity-80">· left {e.leftEarlyMinutes}m early</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Start</Label>
            <Input type="time" value={startTime} onChange={(ev) => setStartTime(ev.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End</Label>
            <Input type="time" value={endTime} onChange={(ev) => setEndTime(ev.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Site</Label>
          <Select value={locationId || "any"} onValueChange={(v) => setLocationId(v === "any" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Any site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any site</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Note (optional)</Label>
          <Textarea rows={2} maxLength={240} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Covering for Ben" />
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {existing && existing.status !== "cancelled" && (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => upsert.mutate("cancelled")} disabled={upsert.isPending}>
                Cancel this day
              </Button>
            )}
            {existing?.source === "shift" && (
              <Button type="button" variant="ghost" onClick={() => removeOverride.mutate()} disabled={removeOverride.isPending}>
                <FileText className="h-4 w-4" /> Use contract
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="button" onClick={() => upsert.mutate("scheduled")} disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : existing?.status === "cancelled" ? "Restore shift" : "Save shift"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
