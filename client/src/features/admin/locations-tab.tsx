import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Edit, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cleanError, type Location } from "@/lib/types";
import { useAssignments, useLocations } from "./use-admin-data";

export function LocationsTab({ organizationId }: { organizationId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading } = useLocations();
  const { data: assignments = [] } = useAssignments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [toDelete, setToDelete] = useState<Location | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/locations", { method: "POST", body: data }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Location added" });
    },
    onError: (e) => toast({ title: "Couldn't add location", description: cleanError(e), variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => apiRequest(`/api/locations/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      toast({ title: "Location updated" });
    },
    onError: (e) => toast({ title: "Couldn't update location", description: cleanError(e), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/locations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast({ title: "Location deleted" });
    },
    onError: (e) => toast({ title: "Couldn't delete location", description: cleanError(e), variant: "destructive" }),
  });

  const open = (loc?: Location) => {
    setEditing(loc ?? null);
    setDialogOpen(true);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const lat = fd.get("latitude") ? parseFloat(String(fd.get("latitude"))) : undefined;
    const lng = fd.get("longitude") ? parseFloat(String(fd.get("longitude"))) : undefined;
    const base = {
      name: String(fd.get("name") || "").trim(),
      postcode: String(fd.get("postcode") || "").trim().toUpperCase(),
      address: String(fd.get("address") || "").trim(),
      radiusMeters: parseInt(String(fd.get("radiusMeters") || "100"), 10) || 100,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...base, latitude: lat != null ? String(lat) : undefined, longitude: lng != null ? String(lng) : undefined });
    } else {
      createMutation.mutate({ ...base, latitude: lat, longitude: lng, organizationId });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Locations
          </CardTitle>
          <CardDescription>Sites where staff can clock in. Set a radius so clock-ins only count on site.</CardDescription>
        </div>
        <Button onClick={() => open()}>
          <Plus className="h-4 w-4" /> Add location
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : locations.length === 0 ? (
          <EmptyState
            icon={<MapPin />}
            title="No locations yet"
            description="Without locations, staff can clock in from anywhere. Add a site to enable geofencing."
            action={<Button onClick={() => open()}>Add location</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Postcode</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => {
                  const count = assignments.filter((a) => a.location.id === loc.id).length;
                  const hasGps = !!(loc.latitude && loc.longitude);
                  return (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell>{loc.postcode}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{loc.address || "—"}</TableCell>
                      <TableCell>{loc.radiusMeters} m</TableCell>
                      <TableCell>
                        <Badge variant="outline">{count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={hasGps ? "border-success/40 text-success" : "border-warning/40 text-warning"}>
                          {hasGps ? "Set" : "Missing"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => open(loc)}>
                            <Edit className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToDelete(loc)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle>
            <DialogDescription>Latitude and longitude are needed for geofencing. Find them on Google Maps by right-clicking the building.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4" key={editing?.id ?? "new"}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name ?? ""} placeholder="Main site" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" name="postcode" defaultValue={editing?.postcode ?? ""} placeholder="SW1A 1AA" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="radiusMeters">Radius (metres)</Label>
                <Input id="radiusMeters" name="radiusMeters" type="number" min={25} defaultValue={editing?.radiusMeters ?? 100} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" defaultValue={editing?.address ?? ""} placeholder="Full address" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" name="latitude" type="number" step="any" defaultValue={editing?.latitude ?? ""} placeholder="51.5074" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" name="longitude" type="number" step="any" defaultValue={editing?.longitude ?? ""} placeholder="-0.1278" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save changes" : "Add location"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "location"}?`}
        description="Staff assigned to this site will be unassigned. Attendance history is kept."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </Card>
  );
}
