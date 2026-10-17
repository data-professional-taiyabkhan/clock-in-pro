import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRICE, PlanButton, useBillingStatus, useCheckout, usePortal } from "@/components/subscription-gate";
import { cn } from "@/lib/utils";

const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMMM yyyy") : "—");
const gbp = (n: number) => `£${n.toFixed(2)}`;

export function BillingTab() {
  const { data: s, isLoading } = useBillingStatus();
  const checkout = useCheckout();
  const portal = usePortal();

  if (isLoading || !s) return <Skeleton className="h-64 w-full" />;

  if (!s.stripeConfigured) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Billing is not configured on this server. Set the Stripe keys to enable it.</CardContent>
      </Card>
    );
  }

  const planLabel = s.plan === "annual" ? "Annual" : "Monthly";
  const perSeat = s.plan ? PRICE[s.plan] : PRICE.monthly;
  const chargeLabel = s.plan === "annual" ? `${gbp(s.activeEmployees * perSeat * 12)} per year` : `${gbp(s.activeEmployees * perSeat)} per month`;

  const headline =
    s.reason === "payment_failed"
      ? { tone: "destructive", icon: AlertTriangle, title: "Payment failed", body: "We couldn't charge your card. Your team keeps clocking in while Stripe retries, but update your card to avoid losing access." }
      : s.reason === "trial_no_card"
        ? { tone: "warning", icon: AlertTriangle, title: `Free month: ${s.trialDaysRemaining} day${s.trialDaysRemaining === 1 ? "" : "s"} left`, body: `No card on file yet. Add one before ${fmtDate(s.trialEndsAt)} so nothing interrupts your team. You won't be charged until then.` }
        : s.reason === "trial_with_card"
          ? { tone: "success", icon: CheckCircle2, title: `Free month until ${fmtDate(s.trialEndsAt)}`, body: `Card on file. Your first charge on ${fmtDate(s.trialEndsAt)} will be for ${s.activeEmployees} active employee${s.activeEmployees === 1 ? "" : "s"} on the ${planLabel.toLowerCase()} plan: ${chargeLabel}.` }
          : s.reason === "subscription_active"
            ? { tone: "success", icon: CheckCircle2, title: `${planLabel} plan · active`, body: s.cancelAtPeriodEnd ? `Cancels on ${fmtDate(s.currentPeriodEnd)}. Reactivate from the billing portal if that was a mistake.` : `Next invoice on ${fmtDate(s.currentPeriodEnd)} for ${s.activeEmployees} active employee${s.activeEmployees === 1 ? "" : "s"}: ${chargeLabel}.` }
            : { tone: "destructive", icon: AlertTriangle, title: "No active subscription", body: "Your free month has ended. Choose a plan below to restore access for your team." };

  const HeadIcon = headline.icon;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between",
          headline.tone === "destructive" && "border-destructive/40",
          headline.tone === "warning" && "border-warning/40",
          headline.tone === "success" && "border-success/40"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              headline.tone === "destructive" && "bg-destructive/10 text-destructive",
              headline.tone === "warning" && "bg-warning/15 text-warning",
              headline.tone === "success" && "bg-success/10 text-success"
            )}
          >
            <HeadIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{headline.title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{headline.body}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {s.hasSubscription ? (
            <Button onClick={() => portal.mutate()} disabled={portal.isPending} variant={s.paymentFailed ? "destructive" : "default"}>
              <CreditCard className="h-4 w-4" /> {s.paymentFailed ? "Update card" : "Manage billing"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active employees" value={s.activeEmployees} hint="Billed seats · admins are free" icon={<Users />} tone="primary" />
        <StatCard label="Price per employee" value={gbp(perSeat)} hint={s.plan ? `${planLabel} plan` : "Monthly plan (default)"} icon={<Receipt />} />
        <StatCard label={s.plan === "annual" ? "Per year" : "Per month"} value={chargeLabel.split(" per")[0]} hint={s.reason.startsWith("trial") ? "After your free month" : "Based on today's headcount"} icon={<CreditCard />} tone="success" />
      </div>

      {!s.hasSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>{s.reason === "trial_no_card" ? "Add a card" : "Choose a plan"}</CardTitle>
            <CardDescription>
              {s.reason === "trial_no_card"
                ? "You keep the rest of your free month either way. Billing starts automatically when it ends."
                : "Billing starts as soon as you subscribe."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <PlanButton name="Monthly" price={gbp(PRICE.monthly)} note="per employee / month" onClick={() => checkout.mutate("monthly")} disabled={checkout.isPending} />
            <PlanButton name="Annual" price={gbp(PRICE.annual)} note="per employee / month, billed yearly" badge="Save 14%" highlighted onClick={() => checkout.mutate("annual")} disabled={checkout.isPending} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How billing works</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <p>You are billed per <b className="text-foreground">active employee</b>. Deactivate or remove someone and they stop being billed the same day; new employees are prorated.</p>
          <p>Admin accounts never count. The seat count syncs to Stripe automatically whenever your team changes, and once a day as a safety net.</p>
          <p>Invoices, receipts, card changes, plan switches and cancellation are all in the Stripe billing portal.</p>
          <p>Prices exclude VAT where applicable. Cancel anytime; access continues to the end of the paid period.</p>
        </CardContent>
        {s.hasSubscription && (
          <CardContent className="pt-0">
            <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <ExternalLink className="h-4 w-4" /> Invoices and receipts
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** Slim banner for the top of the admin dashboard. */
export function BillingBanner({ onOpenBilling }: { onOpenBilling: () => void }) {
  const { data: s } = useBillingStatus();
  const portal = usePortal();
  if (!s || !s.stripeConfigured) return null;

  if (s.paymentFailed) {
    return (
      <Banner tone="destructive" text="Payment failed. Update your card to keep your team's access." action="Update card" onAction={() => portal.mutate()} />
    );
  }
  if (s.reason === "trial_no_card") {
    return (
      <Banner
        tone="warning"
        text={`Your free month ends in ${s.trialDaysRemaining} day${s.trialDaysRemaining === 1 ? "" : "s"}. Add a card now and nothing changes until then.`}
        action="Add a card"
        onAction={onOpenBilling}
      />
    );
  }
  if (s.reason === "subscription_required") {
    return <Banner tone="destructive" text="No active subscription. Choose a plan to restore access for your team." action="Choose a plan" onAction={onOpenBilling} />;
  }
  if (s.cancelAtPeriodEnd) {
    return <Banner tone="muted" text={`Your subscription is set to cancel on ${fmtDate(s.currentPeriodEnd)}.`} action="Reactivate" onAction={() => portal.mutate()} />;
  }
  return null;
}

function Banner({ tone, text, action, onAction }: { tone: "warning" | "destructive" | "muted"; text: string; action: string; onAction: () => void }) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        tone === "warning" && "border-warning/40 bg-warning/10",
        tone === "destructive" && "border-destructive/40 bg-destructive/10",
        tone === "muted" && "border-border bg-muted/40"
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn("h-4 w-4 shrink-0", tone === "warning" && "text-warning", tone === "destructive" && "text-destructive", tone === "muted" && "text-muted-foreground")} />
        <span>{text}</span>
      </div>
      <Button size="sm" variant={tone === "destructive" ? "destructive" : "default"} onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
