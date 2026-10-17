import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPinned, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cleanError, fullName } from "@/lib/types";
import { useAssignments, useEmployees, useLocations } from "./use-admin-data";

export function AssignmentsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees = [] } = useEmployees();
  const { data: locations = [] } = useLocations();
  const { data: assignments = [], isLoading } = useAssignments();
  const [userId, setUserId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");

  const staff = employees.filter((e) => e.role === "employee" && e.isActive);

  const assign = useMutation({
    mutationFn: async (data: { userId: number; locationId: number }) => apiRequest("/api/employee-locations", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      toast({ title: "Assigned" });
    },
    onError: (e) => toast({ title: "Couldn't assign", description: cleanError(e), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (data: { userId: number; locationId: number }) => apiRequest(`/api/employee-locations/${data.userId}/${data.locationId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      toast({ title: "Removed" });
    },
    onError: (e) => toast({ title: "Couldn't remove", description: cleanError(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-primary" /> Site assignments
        </CardTitle>
        <CardDescription>Staff with at least one site can only clock in within its radius. Staff with none can clock in anywhere.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label>Employee</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee" />
              </SelectTrigger>
              <SelectContent>
                {staff.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No active employees
                  </SelectItem>
                ) : (
                  staff.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {fullName(e)} · {e.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No locations yet
                  </SelectItem>
                ) : (
                  locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name} ({l.postcode})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!userId || !locationId || assign.isPending}
            onClick={() => assign.mutate({ userId: Number(userId), locationId: Number(locationId) })}
          >
            {assign.isPending ? "Assigning…" : "Assign"}
          </Button>
        </div>

        {isLoading ? null : assignments.length === 0 ? (
          <EmptyState icon={<MapPinned />} title="No assignments yet" description="Everyone can currently clock in from anywhere." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={`${a.userId}-${a.locationId}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <AvatarInitials name={fullName(a.user)} className="h-8 w-8" />
                      <div>
                        <p className="font-medium">{fullName(a.user)}</p>
                        <p className="text-xs text-muted-foreground">{a.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{a.location.name}</TableCell>
                  <TableCell>{a.location.postcode}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => remove.mutate({ userId: a.userId, locationId: a.locationId })}>
                      <X className="h-4 w-4" /> Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
