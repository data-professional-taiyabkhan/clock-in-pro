import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

/**
 * Middleware that gates access on an active trial or subscription.
 * Attach AFTER requireAuth on any route that should be billing-gated.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
    // Routes that are always accessible
    const exemptPrefixes = [
        "/api/login",
        "/api/signup",
        "/api/logout",
        "/api/user",
        "/api/billing/",
        "/api/org/",
    ];
    if (exemptPrefixes.some(p => req.path.startsWith(p))) return next();

    const orgId = req.user?.organizationId;
    if (!orgId) {
        return res.status(403).json({ message: "Organisation required", code: "NO_ORGANISATION" });
    }

    const org = await storage.getOrganization(orgId);
    if (!org) {
        return res.status(404).json({ message: "Organisation not found" });
    }

    // Trial still active?
    if (org.trialEndsAt && new Date(org.trialEndsAt) > new Date()) {
        return next();
    }

    // Active subscription?
    const sub = await storage.getSubscription(orgId);
    if (sub && ["active", "trialing"].includes(sub.status)) {
        return next();
    }

    return res.status(402).json({
        message: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
    });
}
