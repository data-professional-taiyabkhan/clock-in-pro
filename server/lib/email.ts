import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || "Clock-in Pro <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "http://localhost:5000";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { ok: false, skipped: true };
  }
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
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

export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  organisationName: string;
  token: string;
  role: string;
}) {
  const link = `${APP_URL}/register-with-token?token=${params.token}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2>You've been invited to ${escapeHtml(params.organisationName)}</h2>
      <p>${escapeHtml(params.inviterName)} has invited you to join their team
      on Clock-in Pro as <b>${escapeHtml(params.role)}</b>.</p>
      <p><a href="${link}" style="display:inline-block;background:#2563eb;color:white;
      padding:12px 20px;border-radius:8px;text-decoration:none">Accept invitation</a></p>
      <p style="color:#666;font-size:14px">This link expires in 7 days. If you weren't
      expecting this invitation, you can safely ignore this email.</p>
    </div>`;
  return send(params.to, `You've been invited to ${params.organisationName}`, html);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  firstName: string;
  token: string;
}) {
  const link = `${APP_URL}/reset-password?token=${params.token}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2>Reset your Clock-in Pro password</h2>
      <p>Hi ${escapeHtml(params.firstName)},</p>
      <p>Click the link below to reset your password. The link expires in 1 hour.</p>
      <p><a href="${link}" style="display:inline-block;background:#2563eb;color:white;
      padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
      <p style="color:#666;font-size:14px">If you didn't request this, ignore this email.</p>
    </div>`;
  return send(params.to, `Reset your Clock-in Pro password`, html);
}

export async function sendTrialExpiringEmail(params: {
  to: string;
  firstName: string;
  organisationName: string;
  daysRemaining: number;
}) {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2>Your Clock-in Pro trial expires in ${params.daysRemaining} day(s)</h2>
      <p>Hi ${escapeHtml(params.firstName)},</p>
      <p>Your free trial for <b>${escapeHtml(params.organisationName)}</b> ends in
      ${params.daysRemaining} day(s). Add a payment method to keep your team's
      attendance running without interruption.</p>
      <p><a href="${APP_URL}/" style="display:inline-block;background:#2563eb;color:white;
      padding:12px 20px;border-radius:8px;text-decoration:none">Add payment method</a></p>
      <p style="color:#666;font-size:14px">£3.50 per active employee per month.
      Admin/manager seats are always free. Cancel any time.</p>
    </div>`;
  return send(params.to, `Your Clock-in Pro trial ends in ${params.daysRemaining} day(s)`, html);
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
