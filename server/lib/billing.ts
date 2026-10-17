/**
 * Stripe billing helpers shared by signup, the billing routes, webhooks,
 * the entitlement middleware and background jobs.
 *
 * Model: every organisation gets a 30-day free month. A card is collected at
 * signup through Stripe Checkout (subscription mode with a trial), so billing
 * starts automatically on day 31 for each active employee. Admin seats are free.
 */
import type Stripe from "stripe";
import { storage } from "../storage";
import type { Organization, Subscription, User } from "@shared/schema";

export type Plan = "monthly" | "annual";

export const TRIAL_DAYS = 30;
export const PRICE_PER_SEAT: Record<Plan, number> = { monthly: 3.5, annual: 3.0 };
/** Subscription statuses that keep the organisation usable. past_due is tolerated while Stripe retries. */
export const ENTITLED_STATUSES = ["active", "trialing", "past_due"];
const STRIPE_API_VERSION = "2026-04-22.dahlia";

let stripeClient: Stripe | null | undefined;

export const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

export async function getStripe(): Promise<Stripe | null> {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    stripeClient = null;
    return null;
  }
  const StripeCtor = (await import("stripe")).default;
  stripeClient = new StripeCtor(key, { apiVersion: STRIPE_API_VERSION as any });
  return stripeClient;
}

export function getPriceId(plan: Plan): string | undefined {
  return plan === "annual" ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY;
}

export function planFromPriceId(priceId?: string | null): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
  return null;
}

export function trialDaysRemaining(trialEndsAt: Date | string | null | undefined): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

/** Get or create the Stripe customer for an organisation. */
export async function ensureBillingCustomer(org: Organization, admin: User): Promise<string> {
  const existing = await storage.getBillingCustomer(org.id);
  if (existing) return existing.stripeCustomerId;
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const customer = await stripe.customers.create({
    email: admin.email,
    name: org.name,
    metadata: { organisationId: String(org.id), slug: org.slug ?? "" },
  });
  await storage.createBillingCustomer({ organisationId: org.id, stripeCustomerId: customer.id, billingEmail: admin.email });
  return customer.id;
}

/**
 * Create a Checkout session that collects a card and starts a subscription whose
 * trial ends when the organisation's free month ends. Returns null when Stripe
 * is not configured (local development).
 */
export async function createCheckoutSession(opts: { org: Organization; admin: User; plan: Plan; baseUrl: string }): Promise<string | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const priceId = getPriceId(opts.plan);
  if (!priceId) throw new Error(`Stripe price for the ${opts.plan} plan is not configured`);

  const customerId = await ensureBillingCustomer(opts.org, opts.admin);
  // Checkout requires quantity >= 1; the seat sync job corrects it afterwards.
  const quantity = Math.max(1, await storage.getActiveEmployeeCount(opts.org.id));
  const trialDays = trialDaysRemaining(opts.org.trialEndsAt);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity }],
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { organisationId: String(opts.org.id) },
      ...(trialDays > 0
        ? {
            trial_period_days: trialDays,
            trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          }
        : {}),
    },
    success_url: `${opts.baseUrl}/?billing=success`,
    cancel_url: `${opts.baseUrl}/?billing=cancelled`,
    metadata: { organisationId: String(opts.org.id) },
  } as any);

  return session.url ?? null;
}

export async function createPortalSession(orgId: number, returnUrl: string): Promise<string | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const customer = await storage.getBillingCustomer(orgId);
  if (!customer) return null;
  const session = await stripe.billingPortal.sessions.create({ customer: customer.stripeCustomerId, return_url: returnUrl });
  return session.url;
}

// ── Subscription mirroring ────────────────────────────────────────────────

/** Stripe timestamps arrive as unix seconds; tolerate ms, ISO and Date too. */
export function safeDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number") {
    const d = new Date(val < 1e12 ? val * 1000 : val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Normalise the fields we mirror; current_period_end moved to items[0] in newer API versions. */
export function extractSubFields(sub: any) {
  const firstItem = sub.items?.data?.[0] ?? {};
  return {
    periodEnd: safeDate(sub.current_period_end ?? firstItem.current_period_end),
    trialEnd: safeDate(sub.trial_end),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    priceId: (firstItem.price?.id || firstItem.plan?.id || "") as string,
    quantity: Number(firstItem.quantity ?? sub.quantity ?? 0),
    status: String(sub.status),
  };
}

/** Insert or update the local mirror of a Stripe subscription. */
export async function upsertSubscription(sub: any, organisationId?: number): Promise<Subscription | null> {
  let orgId = organisationId ?? (sub.metadata?.organisationId ? parseInt(sub.metadata.organisationId, 10) : undefined);
  if (!orgId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    const customer = customerId ? await storage.getBillingCustomerByStripeId(customerId) : undefined;
    orgId = customer?.organisationId;
  }
  if (!orgId) {
    console.warn(`[billing] Could not map subscription ${sub.id} to an organisation`);
    return null;
  }
  const f = extractSubFields(sub);
  const data = {
    stripePriceId: f.priceId,
    status: f.status,
    currentPeriodEnd: f.periodEnd ?? new Date(),
    cancelAtPeriodEnd: f.cancelAtPeriodEnd,
    trialEndsAt: f.trialEnd,
    activeEmployeeQuantity: f.quantity,
  };
  const existing = await storage.getSubscriptionByStripeId(sub.id);
  if (existing) return storage.updateSubscription(sub.id, data);
  return storage.createSubscription({ organisationId: orgId, stripeSubscriptionId: sub.id, ...data });
}

const lastSyncAt = new Map<number, number>();

/** Pull the latest subscription for an org from Stripe (throttled to once per 30s per org). */
export async function syncSubscriptionFromStripe(orgId: number, force = false): Promise<Subscription | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const customer = await storage.getBillingCustomer(orgId);
  if (!customer) return null;
  const last = lastSyncAt.get(orgId) ?? 0;
  if (!force && Date.now() - last < 30_000) return (await storage.getSubscription(orgId)) ?? null;
  lastSyncAt.set(orgId, Date.now());

  const subs = await stripe.subscriptions.list({ customer: customer.stripeCustomerId, status: "all", limit: 5 });
  if (!subs.data.length) return null;
  const best = subs.data.find((s) => ENTITLED_STATUSES.includes(s.status)) ?? subs.data[0];
  return upsertSubscription(best, orgId);
}

// ── Entitlement + status ──────────────────────────────────────────────────

/** Cheap DB-only check used by the middleware on every request. */
export async function isEntitled(org: Organization): Promise<boolean> {
  if (org.trialEndsAt && new Date(org.trialEndsAt) > new Date()) return true;
  const sub = await storage.getSubscription(org.id);
  return !!sub && ENTITLED_STATUSES.includes(sub.status);
}

export type BillingReason = "trial_no_card" | "trial_with_card" | "subscription_active" | "payment_failed" | "subscription_required" | "org_not_found";

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

export async function computeBillingStatus(orgId: number): Promise<BillingStatus> {
  const org = await storage.getOrganization(orgId);
  const activeEmployees = await storage.getActiveEmployeeCount(orgId);
  const base: BillingStatus = {
    isActive: false,
    reason: "org_not_found",
    stripeConfigured: isStripeConfigured(),
    trialEndsAt: null,
    trialDaysRemaining: 0,
    hasSubscription: false,
    paymentFailed: false,
    plan: null,
    pricePerSeat: PRICE_PER_SEAT.monthly,
    activeEmployees,
    billedSeats: activeEmployees,
    estimatedCharge: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    subscriptionStatus: null,
  };
  if (!org) return base;

  let sub = (await storage.getSubscription(orgId)) ?? null;
  if (!sub || !ENTITLED_STATUSES.includes(sub.status)) {
    try {
      const synced = await syncSubscriptionFromStripe(orgId);
      if (synced) sub = synced;
    } catch (e) {
      console.warn("[billing] Stripe sync fallback failed:", e);
    }
  }

  const now = new Date();
  const trialActive = !!org.trialEndsAt && new Date(org.trialEndsAt) > now;
  const subEntitled = !!sub && ENTITLED_STATUSES.includes(sub.status);
  const plan = planFromPriceId(sub?.stripePriceId) ?? "monthly";
  const pricePerSeat = PRICE_PER_SEAT[plan];
  const trialEndsAt = sub?.trialEndsAt ?? org.trialEndsAt ?? null;

  let reason: BillingReason;
  if (sub?.status === "past_due") reason = "payment_failed";
  else if (sub?.status === "trialing") reason = "trial_with_card";
  else if (sub?.status === "active") reason = "subscription_active";
  else if (trialActive) reason = "trial_no_card";
  else reason = "subscription_required";

  return {
    ...base,
    isActive: trialActive || subEntitled,
    reason,
    trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
    trialDaysRemaining: trialDaysRemaining(trialEndsAt),
    hasSubscription: !!sub && sub.status !== "canceled" && sub.status !== "incomplete_expired",
    paymentFailed: sub?.status === "past_due",
    plan: sub ? plan : null,
    pricePerSeat,
    billedSeats: activeEmployees,
    estimatedCharge: Math.round(activeEmployees * pricePerSeat * (plan === "annual" ? 12 : 1) * 100) / 100,
    currentPeriodEnd: sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
    cancelAtPeriodEnd: !!sub?.cancelAtPeriodEnd,
    subscriptionStatus: sub?.status ?? null,
  };
}
