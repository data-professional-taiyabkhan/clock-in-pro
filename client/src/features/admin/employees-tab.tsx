import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ScanFace, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cleanError, fullName, type SafeUser } from "@/lib/types";
import { useAssignments, useEmployees } from "./use-admin-data";

export function EmployeesTab({ currentUserId }: { currentUserId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees = [], isLoading } = useEmployees();
  const { data: assignments = [] } = useAssignments();
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<{ user: SafeUser; defaultPassword: string } | null>(null);
  const [toDelete, setToDelete] = useState<SafeUser | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string }) =>
      apiRequest("/api/employees", { method: "POST", body: { ...data, role: "employee" } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      setCreateOpen(false);
      setCreated({ user: result.user, defaultPassword: result.defaultPassword });
    },
    onError: (e) => toast({ title: "Couldn't create employee", description: cleanError(e), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      setToDelete(null);
      toast({ title: "Employee removed" });
    },
    onError: (e) => toast({ title: "Couldn't remove employee", description: cleanError(e), variant: "destructive" }),
  });

  const sorted = [...employees].sort((a, b) => (a.role === b.role ? fullName(a).localeCompare(fullName(b)) : a.role === "admin" ? -1 : 1));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Employees
          </CardTitle>
          <CardDescription>Everyone in your organisation. Only active employees are billed; admins are free.</CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add employee
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={<Users />} title="No employees yet" description="Add your first employee or send an invitation from the Invitations tab." action={<Button onClick={() => setCreateOpen(true)}>Add employee</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Face</TableHead>
                  <TableHead>Sites</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((emp) => {
                  const sites = assignments.filter((a) => a.userId === emp.id).map((a) => a.location);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <AvatarInitials name={fullName(emp)} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{fullName(emp)}</p>
                            <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.role === "admin" ? "default" : "secondary"} className="capitalize">
                          {emp.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {emp.faceRegistered ? (
                          <span className="inline-flex items-center gap-1 text-sm text-success">
                            <ScanFace className="h-4 w-4" /> Registered
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not set up</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sites.length ? (
                          <div className="flex flex-wrap gap-1">
                            {sites.map((s) => (
                              <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Any location</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={emp.isActive ? "border-success/40 text-success" : "border-border text-muted-foreground"}>
                          {emp.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.role !== "admin" && emp.id !== currentUserId && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setToDelete(emp)}>
                            <Trash2 className="h-4 w-4" /> Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>They sign in at your organisation link with the temporary password shown next.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createMutation.mutate({
                firstName: String(fd.get("firstName") || "").trim(),
                lastName: String(fd.get("lastName") || "").trim(),
                email: String(fd.get("email") || "").trim().toLowerCase(),
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" placeholder="Amara" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" placeholder="Okafor" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="amara@company.com" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Created → show temporary password once */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{created ? fullName(created.user) : ""} added</DialogTitle>
            <DialogDescription>Share these details with them. The password is shown only once; they should change it after signing in.</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <CopyRow label="Email" value={created.user.email} />
              <CopyRow label="Temporary password" value={created.defaultPassword} mono />
              <CopyRow label="Sign-in link" value={`${window.location.origin}/org/`} hint="Append your organisation slug (see Settings)" />
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setCreated(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Remove ${toDelete ? fullName(toDelete) : "employee"}?`}
        description="They will no longer be able to sign in or clock in, and they stop counting towards your bill."
        confirmLabel="Remove"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </Card>
  );
}

export function CopyRow({ label, value, mono, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
  const { toast } = useToast();
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className={`min-w-0 flex-1 truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</code>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: "Copied" });
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
