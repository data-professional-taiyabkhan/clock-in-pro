import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cleanError, type EmployeeInvitation } from "@/lib/types";
import { useInvitations } from "./use-admin-data";
import { CopyRow } from "./employees-tab";

export function InvitationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: invitations = [], isLoading } = useInvitations();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: async (data: { email: string; role: string }) => apiRequest("/api/create-invitation", { method: "POST", body: data }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      setEmail("");
      setLastLink(result.invitationUrl);
      toast({ title: "Invitation sent", description: `We emailed ${result.email}. You can also copy the link below.` });
    },
    onError: (e) => toast({ title: "Couldn't send invitation", description: cleanError(e), variant: "destructive" }),
  });

  const linkFor = (inv: EmployeeInvitation) => `${window.location.origin}/invite/${inv.token}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Invitations
        </CardTitle>
        <CardDescription>Invite people by email. They choose their own password and land straight in the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate({ email: email.trim().toLowerCase(), role });
          }}
          className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-[1fr_180px_auto] md:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input id="invite-email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="admin">Admin (free seat)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={invite.isPending}>
            <Send className="h-4 w-4" /> {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </form>

        {lastLink && <CopyRow label="Invitation link (valid 7 days)" value={lastLink} hint="Share this directly if the email doesn't arrive." />}

        {isLoading ? null : invitations.length === 0 ? (
          <EmptyState icon={<Mail />} title="No pending invitations" description="Invitations you send will be listed here until they are accepted or expire." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const expired = new Date(inv.expiresAt).getTime() < Date.now();
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {inv.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={inv.used ? "border-success/40 text-success" : expired ? "border-destructive/40 text-destructive" : "border-warning/40 text-warning"}>
                        {inv.used ? "Accepted" : expired ? "Expired" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(inv.expiresAt), "d MMM yyyy")}</TableCell>
                    <TableCell className="text-right">
                      {!inv.used && !expired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(linkFor(inv));
                            toast({ title: "Link copied" });
                          }}
                        >
                          <Copy className="h-4 w-4" /> Copy
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
