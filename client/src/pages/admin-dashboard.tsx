import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock, CreditCard, LayoutDashboard, Mail, MapPinned, Settings, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell, PageTitle } from "@/components/layout/app-shell";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import type { SafeUser } from "@/lib/types";
import { OverviewTab } from "@/features/admin/overview-tab";
import { EmployeesTab } from "@/features/admin/employees-tab";
import { LocationsTab } from "@/features/admin/locations-tab";
import { AssignmentsTab } from "@/features/admin/assignments-tab";
import { AttendanceTab } from "@/features/admin/attendance-tab";
import { InvitationsTab } from "@/features/admin/invitations-tab";
import { SettingsTab } from "@/features/admin/settings-tab";
import { BillingBanner, BillingTab } from "@/features/admin/billing-tab";
import { useOrganization } from "@/features/admin/use-admin-data";

const tabs = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "employees", label: "Employees", icon: Users },
  { value: "attendance", label: "Attendance", icon: Clock },
  { value: "locations", label: "Locations", icon: Building2 },
  { value: "assignments", label: "Sites", icon: MapPinned },
  { value: "invitations", label: "Invitations", icon: Mail },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "settings", label: "Settings", icon: Settings },
];

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [tab, setTab] = useState("overview");
  const { data: user } = useQuery<SafeUser>({ queryKey: ["/api/user"], queryFn: () => apiRequest("/api/user") });
  const { data: org } = useOrganization();

  const logout = useMutation({
    mutationFn: async () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      globalQueryClient.clear();
      window.location.href = "/";
    },
  });

  if (!user) return null;

  return (
    <AppShell
      user={user}
      org={org ? { name: org.name, logoUrl: org.logoUrl, brandColor: org.brandColor } : null}
      onLogout={() => logout.mutate()}
      onChangePassword={() => setShowPasswordDialog(true)}
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <PageTitle title={`Good ${greeting()}, ${user.firstName}`} subtitle={org?.name} />
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto w-max gap-1 bg-muted/60 p-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5 rounded-lg px-3 py-1.5">
                <t.icon className="h-4 w-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <BillingBanner onOpenBilling={() => setTab("billing")} />
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="employees">
          <EmployeesTab currentUserId={user.id} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsTab organizationId={user.organizationId!} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab />
        </TabsContent>
        <TabsContent value="invitations">
          <InvitationsTab />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
      <ChangePasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} />
    </AppShell>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
