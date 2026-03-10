import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Clock, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface BillingStatus {
    isActive: boolean;
    reason: string;
    trialDaysRemaining: number;
    subscription: {
        status: string;
        currentPeriodEnd: string;
        cancelAtPeriodEnd: boolean;
        activeEmployeeQuantity: number;
    } | null;
}

export function SubscriptionGate({ children }: { children: ReactNode }) {
    const { data: status, isLoading } = useQuery<BillingStatus>({
        queryKey: ["/api/billing/status"],
        refetchInterval: 60_000, // Re-check every minute
    });

    const checkoutMutation = useMutation({
        mutationFn: async (priceType: "monthly" | "annual") => {
            const result = await apiRequest("/api/billing/checkout-session", {
                method: "POST",
                body: { priceType },
            });
            if (result.url) {
                window.location.href = result.url;
            }
        },
    });

    const portalMutation = useMutation({
        mutationFn: async () => {
            const result = await apiRequest("/api/billing/portal-session", {
                method: "POST",
            });
            if (result.url) {
                window.location.href = result.url;
            }
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Active — render children
    if (status?.isActive) {
        return <>{children}</>;
    }

    // Inactive — show activation screen
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-xl shadow-xl border-0">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4 h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-amber-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Activate your subscription</CardTitle>
                    <CardDescription className="text-base">
                        Your free trial has ended. Subscribe to continue using Clock-In Pro.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Pricing cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => checkoutMutation.mutate("monthly")}
                            disabled={checkoutMutation.isPending}
                            className="p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-5 w-5 text-slate-500 group-hover:text-blue-600" />
                                <span className="font-semibold">Monthly</span>
                            </div>
                            <p className="text-2xl font-bold">£3.50</p>
                            <p className="text-sm text-muted-foreground">per employee/month</p>
                        </button>

                        <button
                            onClick={() => checkoutMutation.mutate("annual")}
                            disabled={checkoutMutation.isPending}
                            className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors text-left relative"
                        >
                            <span className="absolute -top-2 right-3 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Save 14%
                            </span>
                            <div className="flex items-center gap-2 mb-2">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                                <span className="font-semibold">Annual</span>
                            </div>
                            <p className="text-2xl font-bold">£3.00</p>
                            <p className="text-sm text-muted-foreground">per employee/month</p>
                        </button>
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                        Admin and manager seats are <b>free</b> — only active employees are counted.
                    </p>

                    {status?.subscription && (
                        <div className="pt-2">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => portalMutation.mutate()}
                                disabled={portalMutation.isPending}
                            >
                                Manage existing subscription
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
