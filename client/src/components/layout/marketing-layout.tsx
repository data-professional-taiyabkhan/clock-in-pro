import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn("transition-colors hover:text-foreground", location === l.href && "text-foreground")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="brand-gradient text-white shadow-glow hover:opacity-95">
            <Link href="/signup">
              Start free month <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
                {l.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
              Sign in
            </Link>
            <Button asChild className="mt-2 brand-gradient text-white">
              <Link href="/signup" onClick={() => setOpen(false)}>
                Start free month <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <LogoMark size="sm" />
              <span className="font-semibold">Clock-In Pro</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Face-verified, geofenced clock-in with rotas and lateness tracking for teams with hourly staff.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#features" className="hover:text-foreground">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
              <li><Link href="/signup" className="hover:text-foreground">Start free month</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
              <li><a href="mailto:hello@clockinpro.autostrata.ai" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Clock-In Pro. Built in the UK by AutoStrata.</p>
          <p>Face data never leaves your organisation.</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNav />
      <main className={className}>{children}</main>
      <MarketingFooter />
    </div>
  );
}

/** Shared page hero for legal/info pages. */
export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className="glow-bg px-4 pb-10 pt-16 text-center sm:px-6">
      <div className="mx-auto max-w-2xl">
        {eyebrow && <span className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</span>}
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>}
      </div>
    </section>
  );
}
