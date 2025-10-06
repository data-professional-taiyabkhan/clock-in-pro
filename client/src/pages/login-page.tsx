import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { loginSchema, type LoginData } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { login } from "@/lib/api";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Building2, ArrowLeft } from "lucide-react";
import type { Organization } from "@shared/schema";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string>("");
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["/api/organizations"],
    queryFn: () => apiRequest("/api/organizations"),
  });

  // Get organization selection from localStorage
  useEffect(() => {
    const selectedOrgId = localStorage.getItem("selectedOrganizationId");
    if (selectedOrgId && organizations.length > 0) {
      // Find the organization from the list
      const orgId = parseInt(selectedOrgId);
      const foundOrg = organizations.find((org: Organization) => org.id === orgId);
      if (foundOrg) {
        setSelectedOrganization(foundOrg);
      }
    }
  }, [organizations]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      // Include organization ID in login if available
      const organizationId = selectedOrganization?.id;
      return await login(data.email, data.password, organizationId);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      // Clear the selected organization from localStorage
      localStorage.removeItem("selectedOrganizationId");
      setLocation("/");
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const onSubmit = (data: LoginData) => {
    setError("");
    loginMutation.mutate(data);
  };

  const handleBackToSelection = () => {
    localStorage.removeItem("selectedOrganizationId");
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Attendance System
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to track your attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Organization Selection Display */}
          {selectedOrganization && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      {selectedOrganization.name}
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      {selectedOrganization.currentEmployees} employees
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToSelection}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Change
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Employee? Contact your manager for account setup.</p>
            <p className="mt-1">Manager/Admin? Use your assigned credentials.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}