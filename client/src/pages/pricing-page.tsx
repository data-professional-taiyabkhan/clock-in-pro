import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Clock, ArrowRight, Zap } from "lucide-react";

export default function PricingPage() {
    const [employeeCount, setEmployeeCount] = useState(10);
    const monthlyCost = (employeeCount * 3.5).toFixed(2);
    const annualCost = (employeeCount * 3.0).toFixed(2);
    const annualSaving = ((employeeCount * 3.5 - employeeCount * 3.0) * 12).toFixed(2);

    const features = [
        "Face verification clock-in",
        "PIN alternative clock-in",
        "Geofencing",
        "Unlimited admin & manager seats",
        "Audit logs & verification trail",
        "CSV exports",
        "Employee invitations",
        "Data retention controls",
        "Biometric consent management",
        "Stripe-powered billing",
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                            Clock-In Pro
                        </span>
                    </Link>
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                        <Link href="/security" className="hover:text-white transition-colors duration-200">Security</Link>
                        <Link href="/login" className="hover:text-white transition-colors duration-200">Sign in</Link>
                        <Link href="/signup">
                            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02]">
                                Start free trial <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Header */}
            <section className="pt-20 pb-12 px-6 text-center relative">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-600/10 to-transparent rounded-full blur-3xl" />
                </div>
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-blue-300 px-5 py-2 rounded-full text-sm font-medium mb-6">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        Simple, transparent pricing
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                        Pay per <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">active employee</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-lg mx-auto">
                        Admin and manager seats are <b className="text-white">always free</b>. No hidden fees.
                    </p>
                </div>
            </section>

            {/* Pricing cards */}
            <section className="pb-20 px-6">
                <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
                    {/* Monthly */}
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 hover:bg-white/[0.06] hover:border-white/15 transition-all duration-300">
                        <h2 className="text-lg font-semibold text-white mb-1">Monthly</h2>
                        <div className="mb-4 mt-3">
                            <span className="text-5xl font-extrabold text-white">£3.50</span>
                            <span className="text-slate-400 ml-2 text-sm">/ employee / month</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Flexible — cancel any time.</p>
                        <Link href="/signup">
                            <Button variant="outline" className="w-full border-white/10 text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl h-11 transition-all duration-200">
                                Start free trial
                            </Button>
                        </Link>
                        <ul className="mt-6 space-y-3 text-sm">
                            {features.map(f => (
                                <li key={f} className="flex items-center gap-3 text-slate-300">
                                    <Check className="h-4 w-4 text-green-400 shrink-0" />{f}
                                </li>
                            ))}
                            <li className="flex items-start gap-3 opacity-70">
                                <Check className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-medium text-slate-400">Shift scheduling &amp; lateness tracking</span>
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Coming soon</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Annual */}
                    <div className="bg-gradient-to-b from-blue-600/10 to-violet-600/5 border border-blue-500/30 rounded-2xl p-7 relative shadow-xl shadow-blue-500/10">
                        <div className="absolute -top-3 right-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg">
                            Save 14%
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-1">Annual</h2>
                        <div className="mb-4 mt-3">
                            <span className="text-5xl font-extrabold text-white">£3.00</span>
                            <span className="text-slate-400 ml-2 text-sm">/ employee / month</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Billed annually. Best value.</p>
                        <Link href="/signup">
                            <Button className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white rounded-xl h-11 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:scale-[1.01]">
                                Start free trial <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </Link>
                        <ul className="mt-6 space-y-3 text-sm">
                            {features.map(f => (
                                <li key={f} className="flex items-center gap-3 text-slate-300">
                                    <Check className="h-4 w-4 text-green-400 shrink-0" />{f}
                                </li>
                            ))}
                            <li className="flex items-start gap-3 opacity-70">
                                <Check className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-medium text-slate-400">Shift scheduling &amp; lateness tracking</span>
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Coming soon</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Calculator */}
            <section className="py-16 px-6 border-y border-white/5 bg-white/[0.02]">
                <div className="max-w-xl mx-auto text-center">
                    <h2 className="text-2xl font-bold mb-2">Cost calculator</h2>
                    <p className="text-slate-400 mb-8">
                        Slide to see your estimated monthly cost for <b className="text-white">{employeeCount}</b> active employee{employeeCount !== 1 ? "s" : ""}.
                    </p>
                    <Slider
                        value={[employeeCount]}
                        onValueChange={(v) => setEmployeeCount(v[0])}
                        min={1}
                        max={500}
                        step={1}
                        className="mb-10"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 text-center">
                            <p className="text-sm text-slate-500 mb-1">Monthly plan</p>
                            <p className="text-4xl font-bold text-white">£{monthlyCost}</p>
                            <p className="text-xs text-slate-500 mt-1">/month</p>
                        </div>
                        <div className="bg-gradient-to-b from-blue-600/10 to-violet-600/5 border border-blue-500/20 rounded-2xl p-6 text-center">
                            <p className="text-sm text-blue-400 font-medium mb-1">Annual plan</p>
                            <p className="text-4xl font-bold text-white">£{annualCost}</p>
                            <p className="text-xs text-blue-400 mt-1">/month · save £{annualSaving}/year</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 px-6">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
                    <Accordion type="single" collapsible className="space-y-2">
                        {[
                            { value: "trial", q: "How long is the free trial?", a: "14 days, with full access to all features. No credit card required to start." },
                            { value: "employee", q: "What counts as an \"active employee\"?", a: "An active employee is any user with the role \"employee\" and the \"Active\" status enabled. Admin and manager accounts are always free and do not count towards billing." },
                            { value: "cancel", q: "Can I cancel any time?", a: "Yes. Cancel from the Stripe customer portal at any time. Your subscription will remain active until the end of the current billing period." },
                            { value: "biometrics", q: "Is face verification mandatory?", a: "No. Face biometrics are entirely optional. Every employee can choose to clock in with a secure PIN instead. We believe consent must be freely given." },
                            { value: "scaling", q: "What happens if I add more employees mid-month?", a: "Your billing quantity adjusts automatically on a daily basis. New employees are prorated, so you only pay for the days they were active." },
                        ].map(({ value, q, a }) => (
                            <AccordionItem key={value} value={value} className="border border-white/10 rounded-xl px-5 bg-white/[0.02]">
                                <AccordionTrigger className="text-white hover:text-blue-400 transition-colors py-4 text-left">{q}</AccordionTrigger>
                                <AccordionContent className="text-slate-400 pb-4">{a}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/5 bg-[#06060a]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
                            <Clock className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-white">Clock-In Pro</span>
                    </div>
                    <div className="flex gap-6 text-sm text-slate-500">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        <Link href="/security" className="hover:text-white transition-colors">Security</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                    <p className="text-sm text-slate-600">© {new Date().getFullYear()} Clock-In Pro</p>
                </div>
            </footer>
        </div>
    );
}
