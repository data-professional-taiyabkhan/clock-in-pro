import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Clock, ArrowRight } from "lucide-react";

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
        <div className="min-h-screen bg-white">
            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Clock-In Pro
                        </span>
                    </Link>
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                        <Link href="/security" className="hover:text-blue-600 transition-colors">Security</Link>
                        <Link href="/login" className="hover:text-blue-600 transition-colors">Sign in</Link>
                        <Link href="/signup">
                            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg">
                                Start free trial
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Header */}
            <section className="pt-16 pb-8 px-6 text-center">
                <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Simple, transparent pricing</h1>
                <p className="text-lg text-slate-600 max-w-lg mx-auto">
                    Pay per active employee. Admin and manager seats are <b>always free</b>.
                </p>
            </section>

            {/* Pricing cards */}
            <section className="pb-16 px-6">
                <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
                    {/* Monthly */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold">Monthly</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <span className="text-4xl font-extrabold">£3.50</span>
                                <span className="text-slate-500 ml-1">/ employee / month</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-6">Flexible — cancel any time.</p>
                            <Link href="/signup">
                                <Button variant="outline" className="w-full">Start free trial</Button>
                            </Link>
                            <ul className="mt-6 space-y-2 text-sm">
                                {features.map(f => (
                                    <li key={f} className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-green-500 shrink-0" />{f}
                                    </li>
                                ))}
                                <li className="flex items-start gap-2 opacity-70">
                                    <Check className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium">Shift scheduling &amp; lateness tracking</span>
                                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">Coming soon</span>
                                    </div>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Annual */}
                    <Card className="border-blue-300 shadow-md ring-2 ring-blue-100 relative">
                        <div className="absolute -top-3 right-4 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                            Save 14%
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold">Annual</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <span className="text-4xl font-extrabold">£3.00</span>
                                <span className="text-slate-500 ml-1">/ employee / month</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-6">Billed annually. Best value.</p>
                            <Link href="/signup">
                                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                    Start free trial <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                            <ul className="mt-6 space-y-2 text-sm">
                                {features.map(f => (
                                    <li key={f} className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-green-500 shrink-0" />{f}
                                    </li>
                                ))}
                                <li className="flex items-start gap-2 opacity-70">
                                    <Check className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-medium">Shift scheduling &amp; lateness tracking</span>
                                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">Coming soon</span>
                                    </div>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Calculator */}
            <section className="py-16 px-6 bg-slate-50">
                <div className="max-w-xl mx-auto text-center">
                    <h2 className="text-2xl font-bold mb-6">Cost calculator</h2>
                    <p className="text-slate-600 mb-6">
                        Slide to see your estimated monthly cost for <b>{employeeCount}</b> active employee{employeeCount !== 1 ? "s" : ""}.
                    </p>
                    <Slider
                        value={[employeeCount]}
                        onValueChange={(v) => setEmployeeCount(v[0])}
                        min={1}
                        max={500}
                        step={1}
                        className="mb-8"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="border-slate-200">
                            <CardContent className="pt-4 text-center">
                                <p className="text-sm text-slate-500 mb-1">Monthly plan</p>
                                <p className="text-3xl font-bold">£{monthlyCost}</p>
                                <p className="text-xs text-slate-500">/month</p>
                            </CardContent>
                        </Card>
                        <Card className="border-blue-200 bg-blue-50">
                            <CardContent className="pt-4 text-center">
                                <p className="text-sm text-blue-600 font-medium mb-1">Annual plan</p>
                                <p className="text-3xl font-bold text-blue-700">£{annualCost}</p>
                                <p className="text-xs text-blue-500">/month (save £{annualSaving}/year)</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-16 px-6">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
                    <Accordion type="single" collapsible className="space-y-2">
                        <AccordionItem value="trial">
                            <AccordionTrigger>How long is the free trial?</AccordionTrigger>
                            <AccordionContent>
                                14 days, with full access to all features. No credit card required to start.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="employee">
                            <AccordionTrigger>What counts as an "active employee"?</AccordionTrigger>
                            <AccordionContent>
                                An active employee is any user with the role "employee" and the "Active" status enabled.
                                Admin and manager accounts are <b>always free</b> and do not count towards billing.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="cancel">
                            <AccordionTrigger>Can I cancel any time?</AccordionTrigger>
                            <AccordionContent>
                                Yes. Cancel from the Stripe customer portal at any time. Your subscription will remain active until the end of the current billing period.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="biometrics">
                            <AccordionTrigger>Is face verification mandatory?</AccordionTrigger>
                            <AccordionContent>
                                No. Face biometrics are entirely optional. Every employee can choose to clock in with a secure PIN instead. We believe consent must be freely given.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="scaling">
                            <AccordionTrigger>What happens if I add more employees mid-month?</AccordionTrigger>
                            <AccordionContent>
                                Your billing quantity adjusts automatically on a daily basis. New employees are prorated, so you only pay for the days they were active.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-slate-900 text-slate-400 text-sm">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <span className="font-semibold text-white">Clock-In Pro</span>
                    <div className="flex gap-6">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        <Link href="/security" className="hover:text-white transition-colors">Security</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                    <p>© {new Date().getFullYear()} Clock-In Pro</p>
                </div>
            </footer>
        </div>
    );
}
