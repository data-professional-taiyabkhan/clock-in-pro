import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, Code } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { Organization } from "@shared/schema";

export default function Home() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [, setLocation] = useLocation();

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["/api/organizations"],
    queryFn: () => apiRequest("/api/organizations"),
  });

  const handleOrganizationSelect = () => {
    if (selectedOrgId) {
      // Store selected organization in localStorage for the login process
      localStorage.setItem("selectedOrganizationId", selectedOrgId);
      setLocation("/login");
    }
  };

  const handleDeveloperLogin = () => {
    setLocation("/developer-login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Building2 className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Attendance Management System
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Select your organization to continue
          </p>
        </div>

        {/* Organization Selection */}
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Choose Your Organization
            </CardTitle>
            <CardDescription>
              Select the organization you belong to access the attendance system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading organizations...</p>
              </div>
            ) : organizations.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No organizations available</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an organization..." />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org: Organization) => (
                        <SelectItem key={org.id} value={org.id.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{org.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {org.currentEmployees}/{org.maxEmployees} employees
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    onClick={handleOrganizationSelect}
                    disabled={!selectedOrgId}
                    className="w-full"
                    size="lg"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Continue to Login
                  </Button>
                </div>

                {/* Organization Preview */}
                {selectedOrgId && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    {(() => {
                      const selectedOrg = organizations.find((org: Organization) => org.id.toString() === selectedOrgId);
                      if (!selectedOrg) return null;
                      
                      return (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                            {selectedOrg.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-blue-700 dark:text-blue-200">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{selectedOrg.currentEmployees} employees</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Created {new Date(selectedOrg.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Developer Login */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDeveloperLogin}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Code className="h-4 w-4 mr-2" />
            Developer Access
          </Button>
        </div>
      </div>
    </div>
  );
}