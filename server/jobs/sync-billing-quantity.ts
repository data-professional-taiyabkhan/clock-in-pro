/**
 * Syncs the active employee count to Stripe subscription quantity.
 * Called daily via setInterval and on-demand when employees are created/deleted.
 */
import { storage } from "../storage";

async function getStripe() {
    const Stripe = (await import("stripe")).default;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

export async function syncBillingQuantity(organisationId: number): Promise<void> {
    try {
        const stripe = await getStripe();
        if (!stripe) return; // Stripe not configured

        const sub = await storage.getSubscription(organisationId);
        if (!sub || !["active", "trialing"].includes(sub.status)) return;

        // Count active employees (role=employee, isActive=true) — admins/managers excluded
        const count = await storage.getActiveEmployeeCount(organisationId);
        const quantity = Math.max(1, count); // Stripe requires at least 1

        if (quantity === sub.activeEmployeeQuantity) return; // No change

        // Update Stripe subscription quantity
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const itemId = stripeSub.items.data[0]?.id;
        if (!itemId) return;

        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            items: [{ id: itemId, quantity }],
            proration_behavior: "create_prorations",
        });

        // Update local record
        await storage.updateSubscription(sub.stripeSubscriptionId, {
            activeEmployeeQuantity: quantity,
        });

        console.log(`Synced billing quantity for org ${organisationId}: ${quantity} employees`);
    } catch (error) {
        console.error(`Failed to sync billing quantity for org ${organisationId}:`, error);
    }
}

/**
 * Start the daily billing sync job. Iterates all orgs with active subscriptions.
 */
export function startBillingSyncJob(): void {
    const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

    async function runSync() {
        try {
            const orgs = await storage.getAllOrganizations();
            for (const org of orgs) {
                await syncBillingQuantity(org.id);
            }
        } catch (error) {
            console.error("Billing sync job error:", error);
        }
    }

    // Run once at startup (delayed by 30 seconds to let server fully start)
    setTimeout(runSync, 30_000);

    // Then run every 24 hours
    setInterval(runSync, INTERVAL_MS);
    console.log("Billing quantity sync job scheduled (every 24h)");
}
