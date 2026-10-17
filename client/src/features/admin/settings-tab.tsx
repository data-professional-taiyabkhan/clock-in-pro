import { Copy, ExternalLink, Link2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import EmployeeSettings from "@/pages/employee-settings";
import { useOrganization } from "./use-admin-data";

export function SettingsTab() {
  const { toast } = useToast();
  const { data: org } = useOrganization();
  const link = org?.slug ? `${window.location.origin}/org/${org.slug}` : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Organisation
          </CardTitle>
          <CardDescription>Your employee login link. Share it with staff so they sign in to the right organisation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{org?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Slug</p>
              <p className="font-mono text-sm">{org?.slug ?? "—"}</p>
            </div>
          </div>
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
