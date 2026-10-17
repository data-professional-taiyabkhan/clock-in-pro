import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarketingLayout, PageHero } from "@/components/layout/marketing-layout";
import { cn } from "@/lib/utils";

const MONTHLY = 3.5;
const ANNUAL = 3.0;

const included = [
  "Face-verified and PIN clock-in",
  "Geofenced sites, unlimited locations",
  "Weekly contracts and one-off shifts",
  "Lateness and no-show tracking with your own grace period",
  "Branded employee login page",
  "Timesheets and attendance reports",
  "Consent records and biometric data deletion",
  "Email support",
];

const faqs = [
  {
    q: "How does the free month work?",
    a: "Your first 30 days are free with full access to everything. You add a card at signup so there is no interruption later, but you are charged nothing until day 31. Cancel before then and you pay nothing at all.",
  },
  {
    q: "What counts as an active employee?",
    a: "Anyone with the employee role whose account is active. Admin accounts are always free and never count towards your bill. Deactivate an employee and they stop being billed from that day.",
  },
  {
    q: "What happens if I add or remove staff mid-month?",
    a: "Your seat count syncs to Stripe automatically. New employees are prorated, so you only pay for the days they were active.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from the billing portal in your dashboard. Access continues until the end of the period you have paid for.",
  },
  {
    q: "Is face verification mandatory?",
    a: "No. Face verification is opt-in with recorded consent. Every employee can clock in with a secure PIN instead, and can delete their face data whenever they like.",
  },
  {
    q: "Do you store photos of my staff?",
    a: "Registration stores a numeric face descriptor, not a photo library. Matching runs in the browser and on your server. No images are sent to third-party face recognition services.",
  },
];

export default function PricingPage() {
  const [employees, setEmployees] = useState(10);
  const monthly = (employees * MONTHLY).toFixed(2);
  const annualPerMonth = (employees * ANNUAL).toFixed(2);
  const saving = (employees * (MONTHLY - ANNUAL) * 12).toFixed(0);

  return (
    <MarketingLayout>
      <PageHero
        eyebrow="Pricing"
        title={
          <>
            Simple, <span className="brand-gradient-text">per-employee</span> pricing
          </>
        }
        subtitle={
          <>
            First month free on every plan. Admin seats are <b className="text-foreground">always free</b>. No setup fees, no contracts.
          </>
        }
      />

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <PlanCard
            name="Monthly"
            price={MONTHLY}
            note="Billed monthly after your free month"
            cta="Start free month"
          />
          <PlanCard
            name="Annual"
            price={ANNUAL}
            note="Billed yearly after your free month"
            cta="Start free month"
            badge="Save 14%"
            highlighted
          />
        </div>

        <div className="surface mx-auto mt-6 max-w-4xl p-6 sm:p-8">
          <p className="font-semibold">Every plan includes</p>
          <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {included.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/30 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold">Cost calculator</h2>
          <p className="mt-2 text-muted-foreground">
            Slide to see your cost for <b className="text-foreground">{employees}</b> active employee{employees !== 1 ? "s" : ""} after the free month.
          </p>
          <Slider value={[employees]} onValueChange={(v) => setEmployees(v[0])} min={1} max={300} step={1} className="my-8" />
          <div className="grid grid-cols-2 gap-4">
            <div className="surface p-6">
              <p className="text-sm text-muted-foreground">Monthly plan</p>
              <p className="mt-1 text-4xl font-extrabold tabular-nums">£{monthly}</p>
              <p className="mt-1 text-xs text-muted-foreground">per month</p>
            </div>
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
              <p className="text-sm font-medium text-primary">Annual plan</p>
              <p className="mt-1 text-4xl font-extrabold tabular-nums">£{annualPerMonth}</p>
              <p className="mt-1 text-xs text-primary">per month · save £{saving} a year</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-8 space-y-2">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="surface px-5">
                <AccordionTrigger className="py-4 text-left hover:text-primary hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-4 text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-10 text-center">
            <Button size="lg" asChild className="brand-gradient h-12 px-8 text-white shadow-glow hover:opacity-95">
              <Link href="/signup">
                Start your free month <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function PlanCard({ name, price, note, cta, badge, highlighted }: { name: string; price: number; note: string; cta: string; badge?: string; highlighted?: boolean }) {
  return (
    <div className={cn("relative rounded-2xl border p-7", highlighted ? "border-primary/50 bg-primary/5 shadow-glow" : "surface")}>
      {badge && <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{badge}</span>}
      <p className={cn("text-sm font-semibold", highlighted ? "text-primary" : "text-muted-foreground")}>{name}</p>
      <p className="mt-3 text-5xl font-extrabold tracking-tight">
        £{price.toFixed(2)}
        <span className="text-base font-medium text-muted-foreground"> / employee / month</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {["First 30 days free", "Card required at signup, nothing charged until day 31", "Admin seats free", "Cancel anytime"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" /> {t}
          </li>
        ))}
      </ul>
      <Button asChild className={cn("mt-6 w-full", highlighted && "brand-gradient text-white hover:opacity-95")} variant={highlighted ? "default" : "outline"}>
        <Link href="/signup">
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
