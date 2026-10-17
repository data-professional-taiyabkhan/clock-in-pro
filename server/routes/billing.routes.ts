import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth";
import { storage } from "../storage";
import {
  PRICE_PER_SEAT,
  computeBillingStatus,
  createCheckoutSession,
  createPortalSession,
  getStripe,
  planFromPriceId,
  syncSubscriptionFromStripe,
  upsertSubscription,
} from "../lib/billing";
import { sendPaymentFailedEmail, sendTrialEndingEmail } from "../lib/email";

const baseUrlFor = (req: Request) => process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

export function registerBillingRoutes(app: Express) {
  // ── Checkout: add a card / subscribe ──
  app.post("/api/billing/checkout-session", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) return res.status(400).json({ message: "No organisation" });
      const { priceType } = z.object({ priceType: z.enum(["monthly", "annual"]).default("monthly") }).parse(req.body ?? {});
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organisation not found" });

      const url = await createCheckoutSession({ org, admin: req.user!, plan: priceType, baseUrl: baseUrlFor(req) });
      if (!url) return res.status(503).json({ message: "Billing is not configured on this server yet" });
      res.json({ url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ message: error?.message || "Failed to create checkout session" });
    }
  });

  // ── Stripe webhook ──
  app.post("/api/billing/webhook", async (req: Request, res: Response) => {
    try {
      const stripe = await getStripe();
      if (!stripe) return res.status(503).json({ message: "Stripe not configured" });
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) return res.status(500).json({ message: "Webhook secret not configured" });

      let event;
      try {
        event = stripe.webhooks.constructEvent((req as any).rawBody || req.body, req.headers["stripe-signature"] as string, secret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(400).json({ message: "Webhook signature failed" });
      }

      if (await storage.getWebhookEvent(event.id)) {
        return res.json({ received: true, message: "Already processed" });
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const orgId = parseInt(session.metadata?.organisationId || "0", 10) || undefined;
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            await upsertSubscription(sub, orgId);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.paused":
        case "customer.subscription.resumed": {
          await upsertSubscription(event.data.object as any);
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          await storage.updateSubscription(sub.id, { status: "canceled" });
          break;
        }
        case "customer.subscription.trial_will_end": {
          const sub = event.data.object as any;
          const mirrored = await upsertSubscription(sub);
          if (mirrored) await notifyAdmins(mirrored.organisationId, "trial_ending", sub);
          break;
        }
        case "invoice.paid": {
          const subId = invoiceSubscriptionId(event.data.object as any);
          if (subId) await storage.updateSubscription(subId, { status: "active" });
          break;
        }
        case "invoice.payment_failed": {
          const subId = invoiceSubscriptionId(event.data.object as any);
          if (subId) {
            const updated = await storage.updateSubscription(subId, { status: "past_due" });
            if (updated) await notifyAdmins(updated.organisationId, "payment_failed");
          }
          break;
        }
      }

      await storage.createWebhookEvent({ stripeEventId: event.id, eventType: event.type });
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // ── Customer portal (manage card, invoices, cancel, switch plan) ──
  app.post("/api/billing/portal-session", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) return res.status(400).json({ message: "No organisation" });
      const url = await createPortalSession(orgId, `${baseUrlFor(req)}/`);
      if (!url) return res.status(404).json({ message: "No billing account yet. Add a card first." });
      res.json({ url });
    } catch (error) {
      console.error("Portal session error:", error);
      res.status(500).json({ message: "Failed to open the billing portal" });
    }
  });

  // ── Status (used by the gate, the admin banner and the Billing tab) ──
  app.get("/api/billing/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) return res.json({ isActive: false, reason: "org_not_found" });
      res.json(await computeBillingStatus(orgId));
    } catch (error) {
      console.error("Billing status error:", error);
      res.status(500).json({ message: "Failed to get billing status" });
    }
  });

  // ── Manual sync from Stripe ──
  app.post("/api/billing/sync", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId;
      if (!orgId) return res.status(400).json({ message: "No organisation" });
      const sub = await syncSubscriptionFromStripe(orgId, true);
      res.json({ synced: !!sub, status: sub?.status ?? null });
    } catch (error) {
      console.error("Billing sync error:", error);
      res.status(500).json({ message: "Failed to sync billing" });
    }
  });
}

/** invoice.subscription moved under invoice.parent.subscription_details in newer API versions. */
function invoiceSubscriptionId(invoice: any): string | null {
  const direct = invoice.subscription;
  if (typeof direct === "string") return direct;
  if (direct?.id) return direct.id;
  const nested = invoice.parent?.subscription_details?.subscription;
  if (typeof nested === "string") return nested;
  if (nested?.id) return nested.id;
  return null;
}

async function notifyAdmins(organisationId: number, kind: "trial_ending" | "payment_failed", sub?: any) {
  try {
    const org = await storage.getOrganization(organisationId);
    if (!org) return;
    const admins = await storage.getOrganizationAdmins(organisationId);
    const seats = await storage.getActiveEmployeeCount(organisationId);
    const plan = planFromPriceId(sub?.items?.data?.[0]?.price?.id) ?? "monthly";
    for (const admin of admins) {
      if (kind === "trial_ending") {
        await sendTrialEndingEmail({
          to: admin.email,
          firstName: admin.firstName,
          organisationName: org.name,
          seats,
          pricePerSeat: PRICE_PER_SEAT[plan],
          plan,
          trialEndsAt: sub?.trial_end ? new Date(sub.trial_end * 1000) : null,
        });
      } else {
        await sendPaymentFailedEmail({ to: admin.email, firstName: admin.firstName, organisationName: org.name });
      }
    }
  } catch (e) {
    console.error(`[billing] Failed to notify admins (${kind}):`, e);
  }
}
