import { Link } from "wouter";
import { MarketingLayout, PageHero } from "@/components/layout/marketing-layout";

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Legal" title="Privacy Policy" subtitle={`Last updated ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`} />
      <section className="px-4 pb-24 sm:px-6">
        <article className="prose prose-neutral mx-auto max-w-3xl dark:prose-invert prose-headings:tracking-tight prose-a:text-primary">
          <h2>1. Data we collect</h2>
          <ul>
            <li><b>Account data:</b> name, email address and role within your organisation.</li>
            <li><b>Attendance data:</b> clock-in and clock-out times, the method used, and the location reported by your device at the time.</li>
            <li><b>Biometric data (optional):</b> a numeric face descriptor created when you register your face, and the consent record for it.</li>
            <li><b>Device and security data:</b> browser type, IP address and a device fingerprint, used to detect suspicious activity.</li>
            <li><b>Billing data:</b> the billing email and subscription status of your organisation. Card details are held by Stripe, never by us.</li>
          </ul>
          <h2>2. How we use your data</h2>
          <ul>
            <li>To provide attendance tracking, rotas and verification services.</li>
            <li>To enforce geofencing and lateness rules set by your organisation.</li>
            <li>To generate reports and audit logs for your organisation.</li>
            <li>To process billing and subscription management via Stripe.</li>
          </ul>
          <h2>3. Biometric data</h2>
          <p>
            Face data is used for authentication only. We do not sell or share biometric data with third parties, and no images are sent to
            external face recognition services. Employees must provide explicit consent before any face data is collected, and may revoke
            consent and delete their face data at any time from their settings.
          </p>
          <h2>4. Data retention</h2>
          <p>
            Organisation administrators can configure data retention periods. When a retention period expires, face data and verification logs
            are permanently deleted. Account data is retained until the account is deleted or the organisation is deactivated.
          </p>
          <h2>5. Data sharing</h2>
          <p>We do not sell personal data. We share data only with:</p>
          <ul>
            <li><b>Stripe:</b> for payment processing (billing email and subscription data only).</li>
            <li><b>Resend:</b> to deliver transactional emails such as invitations and password resets.</li>
          </ul>
          <h2>6. Your rights</h2>
          <p>
            You have the right to access, correct or delete your personal data. Employees can delete their face data from their settings at any
            time. To request full account deletion, contact your organisation administrator.
          </p>
          <h2>7. Security</h2>
          <p>
            All data is encrypted in transit and at rest. See our <Link href="/security">Security page</Link> for details.
          </p>
          <h2>8. Contact</h2>
          <p>
            For privacy enquiries, contact your organisation administrator or email{" "}
            <a href="mailto:privacy@clockinpro.autostrata.ai">privacy@clockinpro.autostrata.ai</a>.
          </p>
        </article>
      </section>
    </MarketingLayout>
  );
}
