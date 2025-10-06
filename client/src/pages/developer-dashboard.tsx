import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, Building2, Users, BarChart3, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertOrganizationSchema, type Organization, type InsertOrganization } from "@shared/schema";
import { format } from "date-fns";

export default function DeveloperDashboard() {
  const [, setLocation] = useLocation();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch all organizations
  const { data: organizations = [], isLoading, error } = useQuery<Organization[]>({
    queryKey: ["/api/developer/organizations"],
    queryFn: async () => {
      try {
        const result = await apiRequest("/api/developer/organizations");
        return result;
      } catch (error: any) {
        if (error.message?.includes("Developer access required")) {
          // Redirect to developer login if not authenticated
          setLocation("/developer-login");
          throw error;
        }
        throw error;
      }
    },
    retry: false, // Don't retry on authentication errors
  });

  // Redirect if authentication error
  useEffect(() => {
    if (error && (error as any).message?.includes("Developer access required")) {
      setLocation("/developer-login");
    }
  }, [error, setLocation]);

  // Create organization form
  const createForm = useForm<InsertOrganization>({
    resolver: zodResolver(insertOrganizationSchema),
    defaultValues: {
      name: "",
      domain: "",
      industry: "",
      size: "small",
    },
  });

  // Edit organization form
  const editForm = useForm<Partial<Organization>>({
    defaultValues: selectedOrg || {},
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (data: InsertOrganization) =>
      apiRequest("/api/developer/organizations", {
        method: "POST",
        body: data
      }),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      toast({
        title: "Organization created",
        description: `Organization created successfully. Admin login: ${response.adminCredentials?.email || 'admin@company.com'} / admin123`,
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Organization> & { id: number }) =>
      apiRequest(`/api/developer/organizations/${id}`, {
        method: "PATCH",
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      toast({
        title: "Organization updated",
        description: "The organization has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedOrg(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/developer/organizations/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/organizations"] });
      toast({
        title: "Organization deleted",
        description: "The organization has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: InsertOrganization) => {
    createOrgMutation.mutate(data);
  };

  const handleEditSubmit = (data: Partial<Organization>) => {
    if (selectedOrg) {
      // Convert string values to proper types
      const processedData = {
        ...data,
        isActive: data.isActive === "true" || data.isActive === true,
        id: selectedOrg.id
      };
      updateOrgMutation.mutate(processedData);
    }
  };

  const handleEdit = (org: Organization) => {
    setSelectedOrg(org);
    editForm.reset(org);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    const secretKey = prompt("To delete this organization, type 'DELETE' to confirm. This action cannot be undone.");
    
    if (secretKey === "DELETE") {
      deleteOrgMutation.mutate(id);
    } else if (secretKey !== null) {
      toast({
        title: "Deletion cancelled",
        description: "The secret key was incorrect. Organization was not deleted.",
        variant: "destructive"
      });
    }
  };

  // Calculate statistics
  const totalOrganizations = organizations.length;
  const totalEmployees = organizations.reduce((sum, org) => sum + (org.currentEmployees || 0), 0);
  const activeOrganizations = organizations.filter(org => org.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">Developer Portal</h1>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await apiRequest("/api/logout", {
                    method: "POST"
                  });
                  setLocation("/developer-login");
                } catch (error) {
                  console.error("Logout error:", error);
                  // Force redirect even if logout fails
                  setLocation("/developer-login");
                }
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrganizations}</div>
              <p className="text-xs text-muted-foreground">
                {activeOrganizations} active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                Across all organizations
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Organization Size</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalOrganizations > 0 ? Math.round(totalEmployees / totalOrganizations) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Employees per organization
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Organizations</CardTitle>
                <CardDescription>Manage all organizations in the system</CardDescription>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>
                      Enter the details for the new organization.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        {...createForm.register("name")}
                        placeholder="Acme Corporation"
                      />
                      {createForm.formState.errors.name && (
                        <p className="text-sm text-red-500">{createForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      <Input
                        id="domain"
                        {...createForm.register("domain")}
                        placeholder="acme.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input
                        id="industry"
                        {...createForm.register("industry")}
                        placeholder="Technology"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="size">Organization Size</Label>
                      <select
                        id="size"
                        {...createForm.register("size")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="small">Small (1-50)</option>
                        <option value="medium">Medium (51-200)</option>
                        <option value="large">Large (201-1000)</option>
                        <option value="enterprise">Enterprise (1000+)</option>
                      </select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createOrgMutation.isPending}>
                      {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading organizations...</div>
            ) : organizations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No organizations yet. Create your first organization to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {organizations.map((org) => (
                  <div key={org.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">{org.name}</h3>
                          <Badge variant={org.isActive ? "default" : "secondary"}>
                            {org.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-gray-500 space-y-1">
                          <p>Domain: {org.domain || "Not set"}</p>
                          <p>Industry: {org.industry || "Not specified"}</p>
                          <p>Size: {org.size}</p>
                          <p>Employees: {org.currentEmployees || 0}</p>
                          <p>Created: {format(new Date(org.createdAt), "PPP")}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(org)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(org.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Organization Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>
                Update the organization details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Organization Name</Label>
                <Input
                  id="edit-name"
                  {...editForm.register("name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-domain">Domain</Label>
                <Input
                  id="edit-domain"
                  {...editForm.register("domain")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-industry">Industry</Label>
                <Input
                  id="edit-industry"
                  {...editForm.register("industry")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-size">Organization Size</Label>
                <select
                  id="edit-size"
                  {...editForm.register("size")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="small">Small (1-50)</option>
                  <option value="medium">Medium (51-200)</option>
                  <option value="large">Large (201-1000)</option>
                  <option value="enterprise">Enterprise (1000+)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-active">Status</Label>
                <select
                  id="edit-active"
                  {...editForm.register("isActive")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={updateOrgMutation.isPending}>
                {updateOrgMutation.isPending ? "Updating..." : "Update Organization"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}