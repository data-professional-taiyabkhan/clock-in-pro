import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
    Shield, Clock, MapPin, FileText, Users, Lock,
    ChevronRight, CheckCircle, ArrowRight, Star, Zap,
    Fingerprint, Globe, BarChart3,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ─── Animated counter hook ───
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setStarted(true);
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = target / (duration / 16);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return { count, ref };
}

// ─── Fade-in on scroll hook ───
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, className: `transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}` };
}

export default function LandingPage() {
    const fade1 = useFadeIn();
    const fade2 = useFadeIn();
    const fade3 = useFadeIn();
    const fade4 = useFadeIn();
    const fade5 = useFadeIn();
    const fadeT1 = useFadeIn();
    const fadeT2 = useFadeIn();
    const fadeT3 = useFadeIn();

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
            {/* ── Navigation ── */}
            <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                            Clock-In Pro
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                        <Link href="/pricing" className="hover:text-white transition-colors duration-200">Pricing</Link>
                        <Link href="/security" className="hover:text-white transition-colors duration-200">Security</Link>
                        <Link href="/login" className="hover:text-white transition-colors duration-200">Sign in</Link>
                        <Link href="/signup">
                            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-blue-500/40 hover:scale-[1.02]">
                                Start free trial <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                    {/* Mobile menu */}
                    <div className="md:hidden flex items-center gap-3">
                        <Link href="/login" className="text-sm text-slate-400 hover:text-white">Sign in</Link>
                        <Link href="/signup">
                            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-lg text-xs">
                                Free trial
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative pt-24 pb-32 px-6">
                {/* Background glow effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute top-40 right-1/4 w-80 h-80 bg-violet-600/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
                    <div className="absolute -top-20 left-1/2 w-[600px] h-[600px] bg-gradient-to-b from-blue-500/5 to-transparent rounded-full blur-3xl" />
                </div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-blue-300 px-5 py-2 rounded-full text-sm font-medium mb-8 backdrop-blur-sm animate-[fadeInUp_0.6s_ease-out]">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        14-day free trial — no credit card required
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-7 animate-[fadeInUp_0.8s_ease-out]">
                        <span className="text-white">Attendance tracking,</span>
                        <br />
                        <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                            made simple & secure
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-[fadeInUp_1s_ease-out]">
                        Face verification, GPS geofencing, and audit-ready logs — all in one platform.
                        With a PIN fallback for employees who prefer not to use biometrics.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-[fadeInUp_1.2s_ease-out]">
                        <Link href="/signup">
                            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white px-10 py-7 text-lg rounded-2xl shadow-2xl shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 hover:scale-[1.03] group">
                                Start free trial
                                <ChevronRight className="h-5 w-5 ml-1 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                        <Link href="/pricing">
                            <Button size="lg" variant="outline" className="px-10 py-7 text-lg rounded-2xl border-white/10 text-slate-300 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-all duration-300">
                                View pricing
                            </Button>
                        </Link>
                    </div>

                    {/* Trust indicators */}
                    <div className="mt-12 flex items-center justify-center gap-6 text-sm text-slate-500 animate-[fadeInUp_1.4s_ease-out]">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            No credit card needed
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            GDPR compliant
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Setup in 2 minutes
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Trust signals ── */}
            <section className="py-16 px-6 border-y border-white/5 bg-white/[0.02]">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div ref={fadeT1.ref} className={fadeT1.className}>
                        <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                            14 days
                        </div>
                        <p className="text-sm text-slate-500 mt-2">Free trial · no card needed</p>
                    </div>
                    <div ref={fadeT2.ref} className={fadeT2.className}>
                        <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                            £3.50
                        </div>
                        <p className="text-sm text-slate-500 mt-2">Per active employee per month</p>
                    </div>
                    <div ref={fadeT3.ref} className={fadeT3.className}>
                        <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            UK · GDPR
                        </div>
                        <p className="text-sm text-slate-500 mt-2">Article 9 biometric consent built in</p>
                    </div>
                </div>
            </section>

            {/* ── How it works ── */}
            <section className="py-24 px-6" ref={fade1.ref}>
                <div className={`max-w-5xl mx-auto ${fade1.className}`}>
                    <div className="text-center mb-16">
                        <span className="text-sm font-semibold text-blue-400 uppercase tracking-widest">How it works</span>
                        <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">Up and running in minutes</h2>
                        <p className="text-slate-400 max-w-lg mx-auto">
                            No hardware. No complicated setup. Just sign up, invite your team, and go.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: "01", title: "Sign up", desc: "Create your organisation and set your locations — takes under 2 minutes.", icon: Users, color: "from-blue-500 to-cyan-500" },
                            { step: "02", title: "Add your team", desc: "Invite staff via email. They register face or PIN on their own device.", icon: Shield, color: "from-violet-500 to-purple-500" },
                            { step: "03", title: "Clock in", desc: "Employees verify using face or PIN with optional geofencing.", icon: Clock, color: "from-pink-500 to-rose-500" },
                        ].map(({ step, title, desc, icon: Icon, color }, i) => (
                            <div key={step} className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300" style={{ animationDelay: `${i * 0.15}s` }}>
                                <div className={`h-12 w-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className="h-6 w-6 text-white" />
                                </div>
                                <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Step {step}</div>
                                <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features grid ── */}
            <section className="py-24 px-6 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent" ref={fade2.ref}>
                <div className={`max-w-5xl mx-auto ${fade2.className}`}>
                    <div className="text-center mb-16">
                        <span className="text-sm font-semibold text-violet-400 uppercase tracking-widest">Features</span>
                        <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">Everything you need</h2>
                        <p className="text-slate-400 max-w-lg mx-auto">
                            A complete attendance management platform built for UK SMBs.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            { icon: Fingerprint, title: "Face verification", desc: "AI-powered face matching for secure, contact-free clock-in.", gradient: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400" },
                            { icon: Lock, title: "PIN alternative", desc: "Employees who prefer not to use biometrics can clock in with a secure PIN.", gradient: "from-violet-500/20 to-violet-600/5", iconColor: "text-violet-400" },
                            { icon: Globe, title: "GPS geofencing", desc: "Ensure employees clock in from approved locations with GPS verification.", gradient: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-400" },
                            { icon: FileText, title: "Audit logs", desc: "Complete verification trail for every clock-in attempt — face or PIN.", gradient: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-400" },
                            { icon: Users, title: "Multi-tenant", desc: "Each organisation gets isolated data, dashboards, and settings.", gradient: "from-pink-500/20 to-pink-600/5", iconColor: "text-pink-400" },
                            { icon: BarChart3, title: "Reports & exports", desc: "Download attendance data as CSV. Filter by date, employee, or location.", gradient: "from-cyan-500/20 to-cyan-600/5", iconColor: "text-cyan-400" },
                        ].map(({ icon: Icon, title, desc, gradient, iconColor }, i) => (
                            <div key={title} className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className={`h-11 w-11 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-4 border border-white/5`}>
                                    <Icon className={`h-5 w-5 ${iconColor}`} />
                                </div>
                                <h3 className="font-semibold mb-1.5 text-white">{title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Compliance ── */}
            <section className="py-24 px-6" ref={fade3.ref}>
                <div className={`max-w-4xl mx-auto ${fade3.className}`}>
                    <div className="text-center mb-16">
                        <span className="text-sm font-semibold text-green-400 uppercase tracking-widest">Compliance</span>
                        <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">Built for trust</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">
                            Face biometrics are <b className="text-white">optional</b>. Every employee can choose PIN instead — because
                            consent must be freely given.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-5">
                        {[
                            { title: "Consent-first design", desc: "Explicit opt-in with timestamped consent records and policy versioning." },
                            { title: "Right to delete", desc: "Employees can delete their face data at any time and switch to PIN." },
                            { title: "Data retention controls", desc: "Admins set how long face images and logs are retained per organisation." },
                        ].map(({ title, desc }) => (
                            <div key={title} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300">
                                <CheckCircle className="h-5 w-5 text-green-400 mb-3" />
                                <h3 className="font-semibold mb-1.5 text-white">{title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Testimonial ── */}
            <section className="py-20 px-6 border-y border-white/5 bg-white/[0.02]" ref={fade4.ref}>
                <div className={`max-w-3xl mx-auto text-center ${fade4.className}`}>
                    <div className="flex items-center justify-center gap-1 mb-6">
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />)}
                    </div>
                    <blockquote className="text-xl md:text-2xl font-medium text-slate-200 leading-relaxed mb-6">
                        "Clock-In Pro replaced our paper sign-in sheets and saved us hours every week.
                        The face verification is incredibly fast and our staff love the simplicity."
                    </blockquote>
                    <p className="text-sm text-slate-500">— Operations Manager, London</p>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative py-28 px-6" ref={fade5.ref}>
                {/* Background glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
                    <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-violet-600/15 rounded-full blur-[100px]" />
                </div>
                <div className={`max-w-3xl mx-auto text-center relative z-10 ${fade5.className}`}>
                    <h2 className="text-3xl md:text-5xl font-bold mb-5">Ready to get started?</h2>
                    <p className="text-slate-400 mb-10 text-lg">
                        Start your 14-day free trial today. No credit card required.
                    </p>
                    <Link href="/signup">
                        <Button size="lg" className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white px-12 py-7 text-lg rounded-2xl shadow-2xl shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 hover:scale-[1.03] group">
                            Start free trial
                            <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="py-12 px-6 border-t border-white/5 bg-[#06060a]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
                            <Clock className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-white">Clock-In Pro</span>
                    </div>
                    <div className="flex gap-6 text-sm text-slate-500">
                        <Link href="/pricing" className="hover:text-white transition-colors duration-200">Pricing</Link>
                        <Link href="/security" className="hover:text-white transition-colors duration-200">Security</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors duration-200">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors duration-200">Terms</Link>
                    </div>
                    <p className="text-sm text-slate-600">© {new Date().getFullYear()} Clock-In Pro</p>
                </div>
            </footer>
        </div>
    );
}
