import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Save, Settings2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cleanError } from "@/lib/types";
import { cn } from "@/lib/utils";
import EmployeeSettings from "@/pages/employee-settings";
import { useOrganization } from "./use-admin-data";

const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Lisbon", "Europe/Amsterdam", "Europe/Warsaw", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC"];
const GRACE_PRESETS = [0, 2, 5, 10, 15];

export function SettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org } = useOrganization();
  const [name, setName] = useState("");
  const [grace, setGrace] = useState(5);
  const [tz, setTz] = useState("Europe/London");

  useEffect(() => {
    if (org) {
      setName(org.name ?? "");
      setGrace(org.latenessGraceMinutes ?? 5);
      setTz(org.timezone ?? "Europe/London");
    }
  }, [org?.id, org?.name, org?.latenessGraceMinutes, org?.timezone]);

  const save = useMutation({
    mutationFn: async () => apiRequest("/api/organization/settings", { method: "PUT", body: { name: name.trim(), latenessGraceMinutes: grace, timezone: tz } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rota"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Settings saved" });
    },
    onError: (e) => toast({ title: "Couldn't save settings", description: cleanError(e), variant: "destructive" }),
  });

  const link = org?.slug ? `${window.location.origin}/org/${org.slug}` : "";
  const dirty = !!org && (name.trim() !== org.name || grace !== (org.latenessGraceMinutes ?? 5) || tz !== (org.timezone ?? "Europe/London"));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Lateness and time
          </CardTitle>
          <CardDescription>Decide what counts as late. Anyone clocking in after their shift start plus this grace period is flagged on the rota and the overview.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Grace period</Label>
            <div className="flex flex-wrap items-center gap-2">
              {GRACE_PRESETS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrace(g)}
                  className={cn("rounded-full border px-3 py-1 text-sm transition-colors", grace === g ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}
                >
                  {g === 0 ? "No grace" : `${g} min`}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={240} value={grace} onChange={(e) => setGrace(Math.max(0, Math.min(240, Number(e.target.value) || 0)))} className="h-9 w-24" />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Example: shift starts 08:00 with a {grace}-minute grace, so 08:{String(grace).padStart(2, "0")} is on time and 08:{String(grace + 1).padStart(2, "0")} is late.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={tz} onValueChange={setTz}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Shift times and attendance dates use this timezone.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organisation name</Label>
              <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Employee login link
          </CardTitle>
          <CardDescription>Share this with staff so they sign in to the right organisation. Customise its look in the Branding tab.</CardDescription>
        </CardHeader>
        <CardContent>
          {link && (
            <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
              <Link2 className="hidden h-5 w-5 text-primary sm:block" />
              <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    toast({ title: "Link copied" });
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your own clock-in settings</h3>
        <EmployeeSettings />
      </div>
    </div>
  );
}
