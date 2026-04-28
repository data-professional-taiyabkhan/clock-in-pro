/**
 * Trial Expiry Reminder Job
 * Sends email reminders to org admins when their trial is about to expire.
 * Runs once daily. Targets orgs whose trialEndsAt is 2–3 days from now.
 */
import { storage } from "../storage";
import { sendTrialExpiringEmail } from "../lib/email";
import { users } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

let lastRunDate: string | null = null;

async function runTrialExpiryReminder(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Skip if already ran today
    if (lastRunDate === today) {
        return;
    }

    console.log("[trial-expiry-reminder] Running...");
    lastRunDate = today;

    try {
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const orgs = await storage.getAllOrganizations();
        let sentCount = 0;

        for (const org of orgs) {
            if (!org.trialEndsAt) continue;

            const trialEnd = new Date(org.trialEndsAt);

            // Only target orgs whose trial ends between now+2d and now+3d
            if (trialEnd < twoDaysFromNow || trialEnd > threeDaysFromNow) continue;

            // Skip orgs that already have an active subscription
            const sub = await storage.getSubscription(org.id);
            if (sub && ["active", "trialing"].includes(sub.status)) continue;

            // Find the admin user for this org
            const [admin] = await db
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.organizationId, org.id),
                        eq(users.role, "admin"),
                        eq(users.isActive, true)
                    )
                )
                .limit(1);

            if (!admin) continue;

            try {
                await sendTrialExpiringEmail({
                    to: admin.email,
                    firstName: admin.firstName,
                    organisationName: org.name,
                    daysRemaining: 3,
                });
                sentCount++;
                console.log(`[trial-expiry-reminder] Sent reminder to ${admin.email} for org "${org.name}"`);
            } catch (err) {
                console.error(`[trial-expiry-reminder] Failed to send to ${admin.email}:`, err);
            }
        }

        console.log(`[trial-expiry-reminder] Done. Sent ${sentCount} reminder(s).`);
    } catch (error) {
        console.error("[trial-expiry-reminder] Job error:", error);
    }
}

/**
 * Start the daily trial expiry reminder job.
 */
export function startTrialExpiryReminderJob(): void {
    const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

    // Run once at startup (delayed 60 seconds to let server fully start)
    setTimeout(runTrialExpiryReminder, 60_000);

    // Then run every 24 hours
    setInterval(runTrialExpiryReminder, INTERVAL_MS);
    console.log("Trial expiry reminder job scheduled (every 24h)");
}
