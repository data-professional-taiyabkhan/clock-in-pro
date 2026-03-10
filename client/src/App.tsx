import React from "react";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import LandingPage from "@/pages/landing-page";
import LoginPage from "@/pages/login-page";
import SignupPage from "@/pages/signup-page";
import PricingPage from "@/pages/pricing-page";
import SecurityPage from "@/pages/security-page";
import PrivacyPage from "@/pages/privacy-page";
import TermsPage from "@/pages/terms-page";
import EmployeeDashboard from "@/pages/employee-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import { SubscriptionGate } from "@/components/subscription-gate";
import { useQuery } from "@tanstack/react-query";

const queryClient = new QueryClient();

function Router() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public marketing pages (always accessible) */}
      <Route path="/pricing" component={PricingPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />

      {!user ? (
        <>
          <Route path="/" component={LandingPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
        </>
      ) : (
        <>
          <Route path="/" component={() => {
            const userRole = (user as any)?.role;

            return (
              <SubscriptionGate>
                {userRole === "employee" ? (
                  <EmployeeDashboard />
                ) : userRole === "admin" ? (
                  <AdminDashboard />
                ) : userRole === "manager" ? (
                  <ManagerDashboard />
                ) : (
                  <ManagerDashboard />
                )}
              </SubscriptionGate>
            );
          }} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;