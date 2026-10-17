/**
 * Keeps the Stripe subscription quantity equal to the number of active
 * employees (role=employee, isActive=true). Admin seats are never billed.
 * Runs daily and on demand whenever employees are added, removed or deactivated.
 */
import { storage } from "../storage";
import { ENTITLED_STATUSES, getStripe } from "../lib/billing";

export async function syncBillingQuantity(organisationId: number): Promise<void> {
  try {
    const stripe = await getStripe();
    if (!stripe) return;

    const sub = await storage.getSubscription(organisationId);
    if (!sub || !ENTITLED_STATUSES.includes(sub.status)) return;

    const quantity = await storage.getActiveEmployeeCount(organisationId);
    if (quantity === sub.activeEmployeeQuantity) return;

    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) return;

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, quantity }],
      proration_behavior: "create_prorations",
    });
    await storage.updateSubscription(sub.stripeSubscriptionId, { activeEmployeeQuantity: quantity });
    console.log(`[billing] Synced seat count for org ${organisationId}: ${quantity}`);
  } catch (error) {
    console.error(`[billing] Failed to sync seat count for org ${organisationId}:`, error);
  }
}

export function startBillingSyncJob(): void {
  const run = async () => {
    try {
      const orgs = await storage.getAllOrganizations();
      for (const org of orgs) await syncBillingQuantity(org.id);
    } catch (error) {
      console.error("[billing] Seat sync job error:", error);
    }
  };
  setTimeout(run, 30_000);
  setInterval(run, 24 * 60 * 60 * 1000);
  console.log("Billing seat sync job scheduled (every 24h)");
}
