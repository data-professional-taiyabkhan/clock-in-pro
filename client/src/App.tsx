import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import LandingPage from "@/pages/landing-page";
import LoginPage from "@/pages/login-page";
import OrgLoginPage from "@/pages/org-login-page";
import SignupPage from "@/pages/signup-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import PricingPage from "@/pages/pricing-page";
import SecurityPage from "@/pages/security-page";
import PrivacyPage from "@/pages/privacy-page";
import TermsPage from "@/pages/terms-page";
import EmployeeDashboard from "@/pages/employee-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import { SubscriptionGate } from "@/components/subscription-gate";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Handle ?billing=success|cancelled after Stripe checkout redirect.
 * Shows a toast and forces billing status re-check.
 */
function useBillingRedirect() {
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");

    if (billing === "success") {
      toast({
        title: "🎉 Subscription activated!",
        description: "Your payment was successful. Welcome to Clock-In Pro!",
      });
      // Force re-check billing status immediately
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      // Clean URL
      window.history.replaceState({}, "", "/");
    } else if (billing === "cancelled") {
      toast({
        title: "Payment cancelled",
        description: "You can subscribe any time from your dashboard.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/");
    }
  }, [toast]);
}

function Router() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  useBillingRedirect();

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
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      {/* Org-specific employee login (always accessible) */}
      <Route path="/org/:slug" component={OrgLoginPage} />

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
                {userRole === "admin" ? (
                  <AdminDashboard />
                ) : (
                  <EmployeeDashboard />
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