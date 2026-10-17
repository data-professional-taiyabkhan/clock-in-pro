import { Link } from "wouter";
import { Shield, Lock, Server, Eye, Trash2, Database, Users } from "lucide-react";
import { MarketingLayout, PageHero } from "@/components/layout/marketing-layout";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-6 transition-colors hover:border-primary/40">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <MarketingLayout>
      <PageHero
        eyebrow="Security"
        title={
          <>
            Security &amp; <span className="brand-gradient-text">data protection</span>
          </>
        }
        subtitle="Clock-In Pro is built with security and privacy as foundations, not afterthoughts."
      />
      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <Section icon={Lock} title="Encryption">
            <p>All data is encrypted in transit via TLS 1.2+ and at rest. Database connections use SSL.</p>
          </Section>
          <Section icon={Shield} title="Biometric data handling">
            <p>
              Face registration stores a numeric descriptor (a list of 128 numbers), not a photo library. Detection runs in the employee's
              browser and matching runs on our server. No images are sent to third-party face recognition services.
            </p>
            <p>
              Employees can <b className="text-foreground">opt out of biometrics entirely</b> and use a secure PIN instead. Consent is recorded
              with a timestamp, policy version and IP address.
            </p>
          </Section>
          <Section icon={Eye} title="Consent and transparency">
            <p>Before any face data is collected, employees must give explicit opt-in consent. Consent can be revoked at any time.</p>
          </Section>
          <Section icon={Trash2} title="Right to delete">
            <p>Any employee can delete their face data from their settings at any time. It is permanently removed from the database.</p>
          </Section>
          <Section icon={Database} title="Data retention">
            <p>Administrators can configure data retention periods per organisation. Face data and verification logs are purged after the configured period.</p>
          </Section>
          <Section icon={Server} title="Infrastructure">
            <p>Clock-In Pro runs on managed cloud infrastructure with automatic patching and a managed PostgreSQL database with automated backups.</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Session-based authentication with secure, HTTP-only cookies</li>
              <li>Passwords hashed with bcrypt</li>
              <li>Rate limiting on verification endpoints</li>
              <li>Device fingerprinting and anomaly flags on clock-in attempts</li>
            </ul>
          </Section>
          <Section icon={Users} title="Multi-tenant isolation">
            <p>Every database query is scoped by organisation. There is no mechanism for one organisation to access another's data.</p>
          </Section>
          <p className="pt-4 text-center text-sm text-muted-foreground">
            Questions? Read our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> or email{" "}
            <a href="mailto:security@clockinpro.autostrata.ai" className="text-primary hover:underline">security@clockinpro.autostrata.ai</a>.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
