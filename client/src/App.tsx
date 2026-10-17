import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { SubscriptionGate } from "@/components/subscription-gate";
import { StagingBanner } from "@/components/staging-banner";
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
import InvitePage from "@/pages/invite-page";
import { Loader2 } from "lucide-react";

/** Handle ?billing=success|cancelled after a Stripe redirect. */
function useBillingRedirect() {
  const { toast } = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (billing === "success") {
      toast({ title: "You're all set", description: "Your card is on file. Nothing is charged until your free month ends." });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      window.history.replaceState({}, "", "/");
    } else if (billing === "cancelled") {
      toast({ title: "Card not added", description: "You can add a card any time from Billing in your dashboard.", variant: "destructive" });
      window.history.replaceState({}, "", "/");
    }
  }, [toast]);
}

function Router() {
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/user"], retry: false });
  useBillingRedirect();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/pricing" component={PricingPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/org/:slug" component={OrgLoginPage} />
      <Route path="/invite/:token" component={InvitePage} />

      {!user ? (
        <>
          <Route path="/" component={LandingPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
        </>
      ) : (
        <>
          <Route path="/">
            <SubscriptionGate>{user.role === "admin" ? <AdminDashboard /> : <EmployeeDashboard />}</SubscriptionGate>
          </Route>
          <Route path="/login">
            <SubscriptionGate>{user.role === "admin" ? <AdminDashboard /> : <EmployeeDashboard />}</SubscriptionGate>
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <StagingBanner />
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
