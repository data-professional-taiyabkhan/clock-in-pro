import { useQuery, useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CreditCard, Loader2, LogOut } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/types";

export type BillingReason = "trial_no_card" | "trial_with_card" | "subscription_active" | "payment_failed" | "subscription_required" | "org_not_found";
export type Plan = "monthly" | "annual";

export interface BillingStatus {
  isActive: boolean;
  reason: BillingReason;
  stripeConfigured: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  hasSubscription: boolean;
  paymentFailed: boolean;
  plan: Plan | null;
  pricePerSeat: number;
  activeEmployees: number;
  billedSeats: number;
  estimatedCharge: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
}

export const PRICE: Record<Plan, number> = { monthly: 3.5, annual: 3.0 };

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("/api/billing/status"),
    refetchInterval: (query) => {
      const data = query.state.data as BillingStatus | undefined;
      return data?.isActive ? 60_000 : 5_000;
    },
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (priceType: Plan) => {
      const result = await apiRequest("/api/billing/checkout-session", { method: "POST", body: { priceType } });
      if (result.url) window.location.href = result.url;
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => {
      const result = await apiRequest("/api/billing/portal-session", { method: "POST" });
      if (result.url) window.location.href = result.url;
    },
  });
}

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { data: status, isLoading } = useBillingStatus();
  const { data: user } = useQuery<SafeUser>({ queryKey: ["/api/user"], queryFn: () => apiRequest("/api/user") });
  const checkout = useCheckout();
  const portal = usePortal();
  const logout = useMutation({
    mutationFn: async () => apiRequest("/api/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status?.isActive) return <>{children}</>;

  const cancelled = status?.subscriptionStatus === "canceled";
  const isAdmin = user?.role === "admin";

  return (
    <div className="glow-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="surface p-6 sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle className="h-7 w-7" />
          </div>

          {!isAdmin ? (
            <>
              <h1 className="text-center text-2xl font-bold">Clock-in is paused</h1>
              <p className="mt-2 text-center text-muted-foreground">
                Your organisation's Clock-In Pro subscription is inactive. Ask your admin to add a payment method, then try again.
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => logout.mutate()}>
                <LogOut className="h-4 w-4" /> Log out
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-bold">{cancelled ? "Your subscription was cancelled" : "Your free month has ended"}</h1>
              <p className="mt-2 text-center text-muted-foreground">
                Choose a plan to keep your team clocking in. You pay only for active employees. Admin seats are free.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <PlanButton name="Monthly" price="£3.50" note="per employee / month" onClick={() => checkout.mutate("monthly")} disabled={checkout.isPending} />
                <PlanButton name="Annual" price="£3.00" note="per employee / month, billed yearly" badge="Save 14%" highlighted onClick={() => checkout.mutate("annual")} disabled={checkout.isPending} />
              </div>
              {status?.hasSubscription && (
                <Button variant="outline" className="mt-4 w-full" onClick={() => portal.mutate()} disabled={portal.isPending}>
                  <CreditCard className="h-4 w-4" /> Open billing portal
                </Button>
              )}
              <p className="mt-4 text-center text-xs text-muted-foreground">Cancel anytime from the billing portal.</p>
              <div className="mt-2 text-center">
                <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => logout.mutate()}>
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlanButton({ name, price, note, badge, highlighted, onClick, disabled }: { name: string; price: string; note: string; badge?: string; highlighted?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative rounded-2xl border p-5 text-left transition-colors disabled:opacity-60",
        highlighted ? "border-primary/50 bg-primary/5 hover:bg-primary/10" : "border-border bg-card hover:border-primary/40"
      )}
    >
      {badge && <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{badge}</span>}
      <p className={cn("text-sm font-semibold", highlighted ? "text-primary" : "text-muted-foreground")}>{name}</p>
      <p className="mt-1 text-3xl font-extrabold">{price}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Choose {name.toLowerCase()} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}
