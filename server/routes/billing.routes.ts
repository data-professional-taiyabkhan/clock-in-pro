import type { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../auth";
import { storage } from "../storage";
import { z } from "zod";

// Stripe is loaded lazily to avoid require-time errors when key is missing
async function getStripe() {
    const Stripe = (await import("stripe")).default;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

export function registerBillingRoutes(app: Express) {
    // ── Create Stripe Checkout session ──
    app.post("/api/billing/checkout-session", requireAuth, requireAdmin, async (req: Request, res: Response) => {
        try {
            const stripe = await getStripe();
            const orgId = req.user!.organizationId;
            if (!orgId) return res.status(400).json({ message: "No organisation" });

            const { priceType } = z.object({ priceType: z.enum(["monthly", "annual"]) }).parse(req.body);

            const priceId = priceType === "monthly"
                ? process.env.STRIPE_PRICE_ID_MONTHLY
                : process.env.STRIPE_PRICE_ID_ANNUAL;

            if (!priceId) return res.status(500).json({ message: `Stripe price ID for ${priceType} not configured` });

            // Get or create Stripe customer
            let billingCustomer = await storage.getBillingCustomer(orgId);
            let stripeCustomerId: string;

            if (billingCustomer) {
                stripeCustomerId = billingCustomer.stripeCustomerId;
            } else {
                const org = await storage.getOrganization(orgId);
                const customer = await stripe.customers.create({
                    email: req.user!.email,
                    name: org?.name || "Organisation",
                    metadata: { organisationId: String(orgId) },
                });
                stripeCustomerId = customer.id;
                await storage.createBillingCustomer({
                    organisationId: orgId,
                    stripeCustomerId: customer.id,
                    billingEmail: req.user!.email,
                });
            }

            // Count active employees for initial quantity
            const quantity = Math.max(1, await storage.getActiveEmployeeCount(orgId));

            // Calculate remaining trial days
            const org = await storage.getOrganization(orgId);
            let trialDays: number | undefined;
            if (org?.trialEndsAt) {
                const remaining = Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (remaining > 0) trialDays = remaining;
            }

            const baseUrl = `${req.protocol}://${req.get("host")}`;
            const session = await stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                mode: "subscription",
                line_items: [{ price: priceId, quantity }],
                ...(trialDays ? { subscription_data: { trial_period_days: trialDays } } : {}),
                success_url: `${baseUrl}/?billing=success`,
                cancel_url: `${baseUrl}/?billing=cancelled`,
                metadata: { organisationId: String(orgId) },
            });

            res.json({ sessionId: session.id, url: session.url });
        } catch (error) {
            console.error("Checkout session error:", error);
            res.status(500).json({ message: "Failed to create checkout session" });
        }
    });

    // ── Stripe webhook ──
    app.post("/api/billing/webhook", async (req: Request, res: Response) => {
        try {
            const stripe = await getStripe();
            const sig = req.headers["stripe-signature"] as string;
            const secret = process.env.STRIPE_WEBHOOK_SECRET;
            if (!secret) return res.status(500).json({ message: "Webhook secret not configured" });

            let event;
            try {
                event = stripe.webhooks.constructEvent((req as any).rawBody || req.body, sig, secret);
            } catch (err) {
                console.error("Webhook signature verification failed:", err);
                return res.status(400).json({ message: "Webhook signature failed" });
            }

            // Idempotency check
            const existing = await storage.getWebhookEvent(event.id);
            if (existing) {
                return res.json({ received: true, message: "Already processed" });
            }

            // Process event
            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object as any;
                    const orgId = parseInt(session.metadata?.organisationId || "0");
                    if (orgId && session.subscription) {
                        const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
                        await storage.createSubscription({
                            organisationId: orgId,
                            stripeSubscriptionId: sub.id,
                            stripePriceId: (sub.items.data[0]?.price?.id) || "",
                            status: sub.status,
                            currentPeriodEnd: new Date(sub.current_period_end * 1000),
                            cancelAtPeriodEnd: sub.cancel_at_period_end,
                            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
                            activeEmployeeQuantity: sub.items.data[0]?.quantity || 0,
                        });
                    }
                    break;
                }
                case "customer.subscription.created":
                case "customer.subscription.updated": {
                    const sub = event.data.object as any;
                    const existingSub = await storage.getSubscriptionByStripeId(sub.id);

                    if (existingSub) {
                        await storage.updateSubscription(sub.id, {
                            status: sub.status,
                            stripePriceId: sub.items?.data?.[0]?.price?.id || existingSub.stripePriceId,
                            currentPeriodEnd: new Date(sub.current_period_end * 1000),
                            cancelAtPeriodEnd: sub.cancel_at_period_end,
                            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
                            activeEmployeeQuantity: sub.items?.data?.[0]?.quantity || 0,
                        });
                    } else {
                        // Find orgId via billing customer
                        const customer = await storage.getBillingCustomerByStripeId(sub.customer);
                        if (customer) {
                            await storage.createSubscription({
                                organisationId: customer.organisationId,
                                stripeSubscriptionId: sub.id,
                                stripePriceId: sub.items?.data?.[0]?.price?.id || "",
                                status: sub.status,
                                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                                cancelAtPeriodEnd: sub.cancel_at_period_end,
                                trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
                                activeEmployeeQuantity: sub.items?.data?.[0]?.quantity || 0,
                            });
                        }
                    }
                    break;
                }
                case "customer.subscription.deleted": {
                    const sub = event.data.object as any;
                    await storage.updateSubscription(sub.id, { status: "canceled" });
                    break;
                }
                case "invoice.paid": {
                    const invoice = event.data.object as any;
                    if (invoice.subscription) {
                        await storage.updateSubscription(invoice.subscription, { status: "active" });
                    }
                    break;
                }
                case "invoice.payment_failed": {
                    const invoice = event.data.object as any;
                    if (invoice.subscription) {
                        await storage.updateSubscription(invoice.subscription, { status: "past_due" });
                    }
                    break;
                }
            }

            // Record event for idempotency
            await storage.createWebhookEvent({
                stripeEventId: event.id,
                eventType: event.type,
            });

            res.json({ received: true });
        } catch (error) {
            console.error("Webhook error:", error);
            res.status(500).json({ message: "Webhook processing failed" });
        }
    });

    // ── Stripe customer portal session ──
    app.post("/api/billing/portal-session", requireAuth, requireAdmin, async (req: Request, res: Response) => {
        try {
            const stripe = await getStripe();
            const orgId = req.user!.organizationId;
            if (!orgId) return res.status(400).json({ message: "No organisation" });

            const billingCustomer = await storage.getBillingCustomer(orgId);
            if (!billingCustomer) {
                return res.status(404).json({ message: "No billing account found. Please subscribe first." });
            }

            const baseUrl = `${req.protocol}://${req.get("host")}`;
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: billingCustomer.stripeCustomerId,
                return_url: `${baseUrl}/`,
            });

            res.json({ url: portalSession.url });
        } catch (error) {
            console.error("Portal session error:", error);
            res.status(500).json({ message: "Failed to create portal session" });
        }
    });

    // ── Billing / entitlement status ──
    app.get("/api/billing/status", requireAuth, async (req: Request, res: Response) => {
        try {
            const orgId = req.user!.organizationId;
            if (!orgId) return res.json({ isActive: false, reason: "no_organisation" });

            const org = await storage.getOrganization(orgId);
            if (!org) return res.json({ isActive: false, reason: "org_not_found" });

            // Check trial
            const now = new Date();
            const trialActive = org.trialEndsAt && new Date(org.trialEndsAt) > now;
            const trialDaysRemaining = org.trialEndsAt
                ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                : 0;

            // Check subscription
            const subscription = await storage.getSubscription(orgId);
            const subActive = subscription && ["active", "trialing"].includes(subscription.status);

            const isActive = !!(trialActive || subActive);

            res.json({
                isActive,
                reason: isActive
                    ? (subActive ? "subscription_active" : "trial_active")
                    : "subscription_required",
                trialDaysRemaining,
                subscription: subscription ? {
                    status: subscription.status,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                    activeEmployeeQuantity: subscription.activeEmployeeQuantity,
                } : null,
            });
        } catch (error) {
            console.error("Billing status error:", error);
            res.status(500).json({ message: "Failed to get billing status" });
        }
    });
}
