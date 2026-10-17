import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  Clock,
  Fingerprint,
  KeyRound,
  Link2,
  MapPin,
  ScanFace,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: ScanFace,
    title: "Face-verified clock-in",
    body: "Staff clock in by looking at their phone. Matching runs on-device and on your server, so no photos are sent to third-party face APIs.",
  },
  {
    icon: MapPin,
    title: "Geofenced locations",
    body: "Set a radius around each site. Clock-ins outside it are refused, so nobody signs in from the bus.",
  },
  {
    icon: CalendarClock,
    title: "Rotas and weekly contracts",
    body: "Set a contract once, for example 08:00 to 12:00 every day except Friday and Sunday, and it applies every week. Add one-off shifts when you need them.",
  },
  {
    icon: Timer,
    title: "Lateness, your rules",
    body: "You decide what counts as late, two minutes or fifteen. Late arrivals and no-shows are flagged on the dashboard the moment they happen.",
  },
  {
    icon: KeyRound,
    title: "PIN fallback and consent",
    body: "Face verification is opt-in with recorded consent. Anyone can use a secure PIN instead, and delete their face data at any time.",
  },
  {
    icon: Link2,
    title: "Your branded employee portal",
    body: "Every organisation gets its own login link with your logo, colours and wallpaper. Share one link and your team is in.",
  },
];

const steps = [
  {
    title: "Create your organisation",
    body: "Two minutes. Add a card so nothing interrupts you later. You are charged nothing for 30 days and can cancel before then at no cost.",
  },
  {
    title: "Share your login link",
    body: "Add staff, assign sites and contracts, and send them your organisation's personal link.",
  },
  {
    title: "Staff clock in from any phone",
    body: "They register their face once, then clock in and out in seconds. You see who is in, who is late and who has not turned up.",
  },
];

function PreviewCard() {
  const rows = [
    { name: "Amara O.", shift: "08:00 – 16:00", status: "On time", at: "07:56", tone: "success" },
    { name: "Ben K.", shift: "08:00 – 16:00", status: "Late +7m", at: "08:12", tone: "warning" },
    { name: "Chloe W.", shift: "09:00 – 17:00", status: "On shift", at: "08:58", tone: "success" },
    { name: "Dev P.", shift: "09:00 – 13:00", status: "No-show", at: "—", tone: "destructive" },
  ];
  return (
    <div className="surface relative mx-auto w-full max-w-md overflow-hidden p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Today</p>
          <p className="font-semibold">Riverside Café</p>
        </div>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">Live</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "On shift", value: "12", cls: "text-foreground" },
          { label: "Late", value: "2", cls: "text-warning" },
          { label: "No-shows", value: "1", cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/60 p-3">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className={cn("text-xl font-bold tabular-nums", s.cls)}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 divide-y divide-border/70">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 py-2.5">
            <div className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white">
              {r.name.split(" ").map((p) => p[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.shift}</p>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  r.tone === "success" && "bg-success/10 text-success",
                  r.tone === "warning" && "bg-warning/15 text-warning",
                  r.tone === "destructive" && "bg-destructive/10 text-destructive"
                )}
              >
                {r.status}
              </span>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{r.at}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute -right-3 -top-3 hidden rotate-6 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg sm:flex">
        <ScanFace className="h-4 w-4 text-primary" />
        <span className="font-medium">Face verified</span>
        <span className="text-muted-foreground">0.4s</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="glow-bg relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" /> First month free · cancel anytime
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Clock-in that <span className="brand-gradient-text">can't be faked.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Face-verified, geofenced attendance for teams with hourly staff. Rotas, lateness and payroll-ready
              timesheets, from £3 per employee a month. Admin seats are free.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="brand-gradient h-12 px-6 text-base text-white shadow-glow hover:opacity-95">
                <Link href="/signup">
                  Start your free month <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {["Set up in minutes, no hardware", "Works on any phone or laptop", "GDPR consent built in", "Cancel before day 31, pay nothing"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up lg:justify-self-end" style={{ animationDelay: "120ms" }}>
            <PreviewCard />
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-y border-border/60 bg-muted/30 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Built for</span>
          {["Cafés & restaurants", "Retail", "Care homes", "Warehouses", "Salons", "Cleaning teams"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20 sm:px-6" id="how-it-works">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">How it works</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Up and running before lunch</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="surface p-6">
                <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white">{i + 1}</div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 px-4 py-20 sm:px-6" id="features">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Features</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Everything an hourly team needs</h2>
            <p className="mt-4 text-muted-foreground">No kiosks, no fobs, no spreadsheets.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="surface group p-6 transition-colors hover:border-primary/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Pricing</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One price per employee. That's it.</h2>
            <p className="mt-4 text-muted-foreground">
              Your first month is free. After that you pay only for active employees. Admin accounts never count. Add
              or remove staff any time and your bill adjusts automatically.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Unlimited sites and shifts", "Face and PIN clock-in", "Rotas, lateness and timesheets", "Branded employee portal", "Email support"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" /> {t}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8" variant="outline">
              <Link href="/pricing">
                Full pricing and calculator <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface p-6">
              <p className="text-sm font-medium text-muted-foreground">Monthly</p>
              <p className="mt-2 text-4xl font-extrabold">£3.50</p>
              <p className="text-sm font-medium text-muted-foreground">per employee per month</p>
              <p className="mt-2 text-sm text-muted-foreground">First month free, then billed monthly.</p>
            </div>
            <div className="relative rounded-2xl border border-primary/40 bg-primary/5 p-6">
              <span className="absolute -top-3 right-4 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Save 14%</span>
              <p className="text-sm font-medium text-primary">Annual</p>
              <p className="mt-2 text-4xl font-extrabold">£3.00</p>
              <p className="text-sm font-medium text-muted-foreground">per employee per month</p>
              <p className="mt-2 text-sm text-muted-foreground">First month free, then billed yearly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-border/60 bg-muted/30 px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Encrypted everywhere", body: "TLS in transit, encrypted at rest, sessions in secure HTTP-only cookies." },
            { icon: Fingerprint, title: "Biometrics you control", body: "Explicit consent is recorded. Staff can switch to PIN or delete their face data whenever they like." },
            { icon: Users, title: "Strict tenant isolation", body: "Every query is scoped to your organisation. Nobody else can see your people or their data." },
          ].map((t) => (
            <div key={t.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <t.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/security" className="text-sm font-medium text-primary hover:underline">
            Read how we protect your data →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="glow-bg px-4 py-24 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Stop paying for hours nobody worked.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Your first month is on us. Set up takes less time than your next shift handover.</p>
          <Button size="lg" asChild className="brand-gradient mt-8 h-12 px-8 text-base text-white shadow-glow hover:opacity-95">
            <Link href="/signup">
              Start your free month <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
