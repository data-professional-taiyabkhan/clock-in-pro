import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { isEntitled } from "../lib/billing";

/**
 * Gates API access on an active free month or an entitled subscription.
 * past_due is tolerated while Stripe retries the card; canceled/unpaid is not.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const exemptPrefixes = [
    "/api/login",
    "/api/signup",
    "/api/logout",
    "/api/user",
    "/api/organization",
    "/api/billing/",
    "/api/org/",
    "/api/password/",
    "/api/invitations/by-token/",
    "/api/register-with-token",
    "/api/health",
  ];
  if (exemptPrefixes.some((p) => req.originalUrl.startsWith(p))) return next();

  const orgId = req.user?.organizationId;
  if (!orgId) {
    return res.status(403).json({ message: "Organisation required", code: "NO_ORGANISATION" });
  }
  const org = await storage.getOrganization(orgId);
  if (!org) return res.status(404).json({ message: "Organisation not found" });

  if (await isEntitled(org)) return next();

  return res.status(402).json({ message: "Subscription required", code: "SUBSCRIPTION_REQUIRED" });
}
