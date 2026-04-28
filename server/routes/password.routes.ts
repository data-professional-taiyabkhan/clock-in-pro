import type { Express, Request, Response } from "express";
import { hashPassword } from "../auth";
import { storage } from "../storage";
import { sendPasswordResetEmail } from "../lib/email";
import { db } from "../db";
import { passwordResetTokens, users } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

export function registerPasswordRoutes(app: Express) {
    // ── Forgot password ──
    app.post("/api/password/forgot", async (req: Request, res: Response) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ message: "Email is required" });
            }

            // Always return 200 to avoid leaking account existence
            res.json({ message: "If an account with that email exists, we've sent a reset link." });

            // Fire-and-forget: look up user and send email
            (async () => {
                try {
                    const user = await storage.getUserByEmail(email);
                    if (!user) return;

                    // Generate secure token
                    const token = crypto.randomBytes(32).toString("hex");
                    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

                    // Store token
                    await db.insert(passwordResetTokens).values({
                        userId: user.id,
                        token,
                        expiresAt,
                    });

                    // Send email
                    await sendPasswordResetEmail({
                        to: user.email,
                        firstName: user.firstName,
                        token,
                    });
                } catch (err) {
                    console.error("[password/forgot] background error:", err);
                }
            })();
        } catch (error) {
            console.error("Forgot password error:", error);
            res.status(500).json({ message: "Something went wrong" });
        }
    });

    // ── Reset password ──
    app.post("/api/password/reset", async (req: Request, res: Response) => {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                return res.status(400).json({ message: "Token and new password are required" });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters" });
            }

            // Find valid token (unused + unexpired)
            const [resetToken] = await db
                .select()
                .from(passwordResetTokens)
                .where(
                    and(
                        eq(passwordResetTokens.token, token),
                        isNull(passwordResetTokens.usedAt)
                    )
                );

            if (!resetToken) {
                return res.status(400).json({ message: "Invalid or expired reset link" });
            }

            if (new Date() > resetToken.expiresAt) {
                return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
            }

            // Hash new password
            const hashedPassword = await hashPassword(newPassword);

            // Update user password
            await storage.updateUserPassword(resetToken.userId, hashedPassword);

            // Mark token as used
            await db
                .update(passwordResetTokens)
                .set({ usedAt: new Date() })
                .where(eq(passwordResetTokens.id, resetToken.id));

            console.log(`Password reset successful for user ${resetToken.userId}`);
            res.json({ message: "Password has been reset successfully. You can now log in." });
        } catch (error) {
            console.error("Reset password error:", error);
            res.status(500).json({ message: "Failed to reset password" });
        }
    });
}
