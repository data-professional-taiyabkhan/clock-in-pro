import { Resend } from "resend";
import { getEnvironment } from "./environment";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || "Clock-In Pro <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "http://localhost:5000";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { ok: false, skipped: true };
  }
  try {
    const env = getEnvironment();
    const finalSubject = env === "production" ? subject : `[${env.toUpperCase()}] ${subject}`;
    const result = await resend.emails.send({ from: FROM, to, subject: finalSubject, html });
    if (result.error) {
      console.error("[email] send failed:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error("[email] send threw:", err);
    return { ok: false, error: err };
  }
}

/** Branded wrapper shared by every transactional email. */
function layout(title: string, body: string, cta?: { label: string; href: string }) {
  return `
  <div style="background:#f4f5fb;padding:32px 16px;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#4f46e5,#8b5cf6);padding:20px 28px;color:#fff;font-weight:700;font-size:18px">Clock-In Pro</div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
        <div style="font-size:15px;line-height:1.6;color:#374151">${body}</div>
        ${cta ? `<p style="margin:24px 0 8px"><a href="${cta.href}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></p>` : ""}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
        Sent by Clock-In Pro · <a href="${APP_URL}" style="color:#6b7280">${APP_URL.replace(/^https?:\/\//, "")}</a>
      </div>
    </div>
  </div>`;
}

export async function sendInvitationEmail(params: { to: string; inviterName: string; organisationName: string; token: string; role: string }) {
  const link = `${APP_URL}/invite/${params.token}`;
  const html = layout(
    `You've been invited to ${escapeHtml(params.organisationName)}`,
    `<p>${escapeHtml(params.inviterName)} has invited you to join <b>${escapeHtml(params.organisationName)}</b> on Clock-In Pro as ${params.role === "admin" ? "an admin" : "an employee"}.</p>
     <p>Click below to choose a password. You'll then be able to clock in and see your shifts.</p>
     <p style="font-size:13px;color:#6b7280">This link expires in 7 days. If you weren't expecting this invitation you can ignore this email.</p>`,
    { label: "Accept invitation", href: link }
  );
  return send(params.to, `You've been invited to ${params.organisationName}`, html);
}

export async function sendPasswordResetEmail(params: { to: string; firstName: string; token: string }) {
  const link = `${APP_URL}/reset-password?token=${params.token}`;
  const html = layout(
    "Reset your password",
    `<p>Hi ${escapeHtml(params.firstName)},</p><p>Click below to choose a new password. The link expires in 1 hour.</p>
     <p style="font-size:13px;color:#6b7280">If you didn't request this, you can ignore this email.</p>`,
    { label: "Reset password", href: link }
  );
  return send(params.to, "Reset your Clock-In Pro password", html);
}

/** Sent by the daily job to organisations whose free month is ending and who have no card on file. */
export async function sendTrialExpiringEmail(params: { to: string; firstName: string; organisationName: string; daysRemaining: number }) {
  const html = layout(
    `Your free month ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? "" : "s"}`,
    `<p>Hi ${escapeHtml(params.firstName)},</p>
     <p>The free month for <b>${escapeHtml(params.organisationName)}</b> ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? "" : "s"} and there is no card on file yet. Add one now so your team keeps clocking in without interruption.</p>
     <p style="font-size:13px;color:#6b7280">£3.50 per active employee per month, or £3.00 on the annual plan. Admin seats are free. Cancel anytime.</p>`,
    { label: "Add a card", href: `${APP_URL}/` }
  );
  return send(params.to, `Your Clock-In Pro free month ends in ${params.daysRemaining} day(s)`, html);
}

/** Sent from the Stripe trial_will_end webhook (3 days before the first charge). */
export async function sendTrialEndingEmail(params: { to: string; firstName: string; organisationName: string; seats: number; pricePerSeat: number; plan: "monthly" | "annual"; trialEndsAt: Date | null }) {
  const when = params.trialEndsAt ? params.trialEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "in 3 days";
  const perPeriod = params.plan === "annual" ? params.seats * params.pricePerSeat * 12 : params.seats * params.pricePerSeat;
  const html = layout(
    "Your free month is ending",
    `<p>Hi ${escapeHtml(params.firstName)},</p>
     <p>The free month for <b>${escapeHtml(params.organisationName)}</b> ends on <b>${when}</b>. Your card on file will then be charged for <b>${params.seats}</b> active employee${params.seats === 1 ? "" : "s"} at £${params.pricePerSeat.toFixed(2)} each${params.plan === "annual" ? " per month, billed annually" : " per month"}: about <b>£${perPeriod.toFixed(2)}</b>.</p>
     <p>Nothing to do if that looks right. To change your plan, update your card or cancel, open Billing in your dashboard.</p>`,
    { label: "Open billing", href: `${APP_URL}/` }
  );
  return send(params.to, "Your Clock-In Pro free month is ending", html);
}

export async function sendPaymentFailedEmail(params: { to: string; firstName: string; organisationName: string }) {
  const html = layout(
    "Payment failed",
    `<p>Hi ${escapeHtml(params.firstName)},</p>
     <p>We couldn't collect payment for <b>${escapeHtml(params.organisationName)}</b>. Your team can keep clocking in for now while we retry, but please update your card to avoid losing access.</p>`,
    { label: "Update payment method", href: `${APP_URL}/` }
  );
  return send(params.to, "Action needed: Clock-In Pro payment failed", html);
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
