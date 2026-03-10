import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Shield, Clock, MapPin, FileText, Users, Lock,
    ChevronRight, CheckCircle, ArrowRight, Star,
} from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Clock-In Pro
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                        <Link href="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
                        <Link href="/security" className="hover:text-blue-600 transition-colors">Security</Link>
                        <Link href="/login" className="hover:text-blue-600 transition-colors">Sign in</Link>
                        <Link href="/signup">
                            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg">
                                Start free trial <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-20 pb-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                        <Shield className="h-4 w-4" />
                        14-day free trial — no credit card required
                    </div>
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
                        Attendance tracking,{" "}
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            made simple & secure
                        </span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Face verification, geofencing, and audit-ready logs. With a PIN fallback for employees
                        who prefer not to use biometrics.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/signup">
                            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-200">
                                Start free trial <ChevronRight className="h-5 w-5 ml-1" />
                            </Button>
                        </Link>
                        <Link href="/pricing">
                            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl border-slate-300">
                                View pricing
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 px-6 bg-slate-50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
                    <p className="text-slate-600 text-center mb-12 max-w-lg mx-auto">
                        Get up and running in minutes. No hardware required.
                    </p>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: "1", title: "Sign up", desc: "Create your organisation and invite your team — takes under 2 minutes.", icon: Users },
                            { step: "2", title: "Add employees", desc: "Invite staff via email. They set up face or PIN on their own device.", icon: Shield },
                            { step: "3", title: "Clock in", desc: "Employees clock in using face verification or PIN with optional geofencing.", icon: Clock },
                        ].map(({ step, title, desc, icon: Icon }) => (
                            <div key={step} className="text-center">
                                <div className="mx-auto mb-4 h-14 w-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                                    <Icon className="h-7 w-7 text-blue-600" />
                                </div>
                                <div className="text-sm font-bold text-blue-600 mb-1">Step {step}</div>
                                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                                <p className="text-slate-600 text-sm">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: Shield, title: "Face verification", desc: "AI-powered face matching for secure, contact-free clock-in." },
                            { icon: Lock, title: "PIN alternative", desc: "Employees who prefer not to use biometrics can clock in with a secure PIN." },
                            { icon: MapPin, title: "Geofencing", desc: "Ensure employees clock in from approved locations with GPS verification." },
                            { icon: FileText, title: "Audit logs", desc: "Complete verification trail for every clock-in attempt — face or PIN." },
                            { icon: Users, title: "Multi-tenant", desc: "Each organisation gets isolated data, dashboards, and settings." },
                            { icon: Clock, title: "Reports & exports", desc: "Download attendance data as CSV. Filter by date, employee, or location." },
                        ].map(({ icon: Icon, title, desc }) => (
                            <Card key={title} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="pt-6">
                                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                                        <Icon className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold mb-1">{title}</h3>
                                    <p className="text-sm text-slate-600">{desc}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Compliance */}
            <section className="py-20 px-6 bg-slate-50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">Built for compliance</h2>
                    <p className="text-slate-600 mb-10 max-w-xl mx-auto">
                        Face biometrics are <b>optional</b>. Every employee can choose PIN instead — because
                        consent must be freely given.
                    </p>
                    <div className="grid md:grid-cols-3 gap-6 text-left">
                        {[
                            { title: "Consent-first design", desc: "Explicit opt-in with timestamped consent records and policy versioning." },
                            { title: "Right to delete", desc: "Employees can delete their face data at any time and switch to PIN." },
                            { title: "Data retention controls", desc: "Admins set how long face images and logs are retained per organisation." },
                        ].map(({ title, desc }) => (
                            <div key={title} className="bg-white rounded-xl p-5 shadow-sm">
                                <CheckCircle className="h-5 w-5 text-green-500 mb-2" />
                                <h3 className="font-semibold mb-1">{title}</h3>
                                <p className="text-sm text-slate-600">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Social proof placeholder */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-1 mb-4">
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />)}
                    </div>
                    <p className="text-lg font-medium text-slate-700 mb-2">
                        "Clock-In Pro replaced our paper sign-in sheets and saved us hours every week."
                    </p>
                    <p className="text-sm text-slate-500">— Operations Manager, London</p>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
                    <p className="text-blue-100 mb-8 text-lg">
                        Start your 14-day free trial today. No credit card required.
                    </p>
                    <Link href="/signup">
                        <Button size="lg" variant="secondary" className="px-8 py-6 text-lg rounded-xl font-semibold">
                            Start free trial <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-slate-900 text-slate-400 text-sm">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <span className="font-semibold text-white">Clock-In Pro</span>
                    </div>
                    <div className="flex gap-6">
                        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/security" className="hover:text-white transition-colors">Security</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                    <p>© {new Date().getFullYear()} Clock-In Pro. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
