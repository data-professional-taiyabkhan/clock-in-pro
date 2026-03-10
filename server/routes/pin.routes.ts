import type { Express, Request, Response } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { setupPinSchema, verifyPinSchema, consentSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";

export function registerPinRoutes(app: Express) {
    // ── Setup / update PIN ──
    app.post("/api/user/setup-pin", requireAuth, async (req: Request, res: Response) => {
        try {
            const { pin } = setupPinSchema.parse(req.body);
            const pinHash = await bcrypt.hash(pin, 10);
            const user = await storage.updateUserPin(req.user!.id, pinHash);
            res.json({ message: "PIN set successfully", pinEnabled: user.pinEnabled });
        } catch (error) {
            console.error("PIN setup error:", error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ message: "Invalid PIN data", errors: error.errors });
            }
            res.status(500).json({ message: "Failed to set PIN" });
        }
    });

    // ── Verify PIN (for clock-in/out) ──
    app.post("/api/user/verify-pin", requireAuth, async (req: Request, res: Response) => {
        try {
            const { pin } = verifyPinSchema.parse(req.body);
            const user = await storage.getUser(req.user!.id);
            if (!user || !user.pinHash || !user.pinEnabled) {
                return res.status(400).json({ message: "PIN not set up. Please set a PIN first." });
            }

            const isValid = await bcrypt.compare(pin, user.pinHash);
            if (!isValid) {
                return res.status(401).json({ message: "Invalid PIN" });
            }

            // Update last PIN used timestamp
            await storage.updateUserPin(user.id, user.pinHash); // Refreshes updatedAt

            res.json({ verified: true });
        } catch (error) {
            console.error("PIN verify error:", error);
            res.status(500).json({ message: "PIN verification failed" });
        }
    });

    // ── Disable PIN ──
    app.delete("/api/user/pin", requireAuth, async (req: Request, res: Response) => {
        try {
            await storage.disableUserPin(req.user!.id);
            res.json({ message: "PIN disabled" });
        } catch (error) {
            console.error("PIN disable error:", error);
            res.status(500).json({ message: "Failed to disable PIN" });
        }
    });

    // ── Delete face data (opt out of biometrics) ──
    app.delete("/api/user/face-data", requireAuth, async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const orgId = req.user!.organizationId;

            // Clear face data from DB
            await storage.clearUserFaceData(userId);

            // Revoke biometric consent
            if (orgId) {
                await storage.revokeConsent(userId, "face_biometric");
            }

            // Ensure PIN is available as fallback
            const user = await storage.getUser(userId);
            const hasPinFallback = user?.pinEnabled && user?.pinHash;

            res.json({
                message: "Face data deleted successfully",
                hasPinFallback,
                recommendation: hasPinFallback
                    ? "You can now clock in/out using your PIN."
                    : "Please set up a PIN to continue clocking in/out.",
            });
        } catch (error) {
            console.error("Face data deletion error:", error);
            res.status(500).json({ message: "Failed to delete face data" });
        }
    });

    // ── Record biometric consent ──
    app.post("/api/user/consent", requireAuth, async (req: Request, res: Response) => {
        try {
            const data = consentSchema.parse(req.body);
            const orgId = req.user!.organizationId;
            if (!orgId) return res.status(400).json({ message: "No organisation" });

            // If revoking, handle that
            if (!data.consentGiven) {
                await storage.revokeConsent(req.user!.id, data.consentType);
                return res.json({ message: "Consent revoked" });
            }

            const consent = await storage.createConsent({
                userId: req.user!.id,
                organisationId: orgId,
                consentType: data.consentType,
                consentGiven: data.consentGiven,
                policyVersion: data.policyVersion,
                ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
                userAgent: req.headers["user-agent"] || null,
            });

            res.json({ message: "Consent recorded", consent });
        } catch (error) {
            console.error("Consent error:", error);
            res.status(500).json({ message: "Failed to record consent" });
        }
    });

    // ── Get user's consent status ──
    app.get("/api/user/consent", requireAuth, async (req: Request, res: Response) => {
        try {
            const orgId = req.user!.organizationId;
            if (!orgId) return res.json({ consents: [] });

            const consents = await storage.getUserConsents(req.user!.id, orgId);
            res.json({ consents });
        } catch (error) {
            console.error("Get consent error:", error);
            res.status(500).json({ message: "Failed to get consent status" });
        }
    });
}
