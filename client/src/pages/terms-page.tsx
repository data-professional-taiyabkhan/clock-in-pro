import { Link } from "wouter";
import { MarketingLayout, PageHero } from "@/components/layout/marketing-layout";

export default function TermsPage() {
  return (
    <MarketingLayout>
      <PageHero eyebrow="Legal" title="Terms of Service" subtitle={`Last updated ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`} />
      <section className="px-4 pb-24 sm:px-6">
        <article className="prose prose-neutral mx-auto max-w-3xl dark:prose-invert prose-headings:tracking-tight prose-a:text-primary">
          <h2>1. The service</h2>
          <p>
            Clock-In Pro provides attendance tracking, rotas and verification tools for organisations. By creating an organisation you agree to
            these terms on behalf of that organisation.
          </p>
          <h2>2. Accounts</h2>
          <p>
            You are responsible for keeping your credentials secure and for the activity of users you add to your organisation. You must have
            the right to process the personal data of the employees you add.
          </p>
          <h2>3. Free month, subscriptions and billing</h2>
          <ul>
            <li>Every new organisation receives a 30-day free period with full access.</li>
            <li>A payment card is added at signup. Nothing is charged until the free period ends. Cancel before then and no charge is made.</li>
            <li>After the free period, subscriptions are billed per active employee (role: employee, status: active).</li>
            <li>Admin accounts are not counted for billing purposes.</li>
            <li>Monthly plan: £3.50 per active employee per month. Annual plan: £3.00 per active employee per month, billed annually.</li>
            <li>Employee counts are adjusted automatically. Prorated charges apply for mid-period changes.</li>
            <li>Payments are processed by Stripe. You can manage your subscription, download invoices and update payment methods from the billing portal.</li>
          </ul>
          <h2>4. Cancellation</h2>
          <p>
            You may cancel at any time from the billing portal. Access continues until the end of the current billing period. No refunds are
            provided for partial periods.
          </p>
          <h2>5. Data and privacy</h2>
          <p>
            Your use of the service is subject to our <Link href="/privacy">Privacy Policy</Link>. Each organisation's data is isolated and
            cannot be accessed by other organisations.
          </p>
          <h2>6. Biometric data</h2>
          <p>
            Face verification is optional. Employees must provide explicit consent before biometric data is collected and may opt out at any
            time without penalty by switching to PIN-based clock-in.
          </p>
          <h2>7. Acceptable use</h2>
          <ul>
            <li>Do not use the service for any unlawful purpose.</li>
            <li>Do not attempt to access another organisation's data.</li>
            <li>Do not reverse-engineer or attempt to extract source code from the service.</li>
            <li>Do not use automated means to access the service beyond normal use.</li>
          </ul>
          <h2>8. Limitation of liability</h2>
          <p>
            The service is provided "as is" without warranty of any kind. We are not liable for indirect, incidental or consequential damages
            arising from your use of the service.
          </p>
          <h2>9. Changes to these terms</h2>
          <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
          <h2>10. Contact</h2>
          <p>
            For questions about these terms, contact <a href="mailto:legal@clockinpro.autostrata.ai">legal@clockinpro.autostrata.ai</a>.
          </p>
        </article>
      </section>
    </MarketingLayout>
  );
}
