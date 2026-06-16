import { Link } from "wouter";
import { Clock } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Clock-In Pro</span>
                    </Link>
                    <div className="flex gap-6 text-sm text-slate-400">
                        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/security" className="hover:text-white transition-colors">Security</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <section className="pt-16 pb-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl font-extrabold mb-2">Privacy Policy</h1>
                    <p className="text-sm text-slate-500 mb-12">Last updated: March 2026</p>

                    <div className="space-y-10 text-slate-400 leading-relaxed">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">1. Data We Collect</h2>
                            <p className="mb-3">We collect the following personal data when you use Clock-In Pro:</p>
                            <ul className="space-y-2 list-disc list-inside text-slate-400">
                                <li><b className="text-slate-300">Account data:</b> name, email address, hashed password.</li>
                                <li><b className="text-slate-300">Organisation data:</b> organisation name, slug, industry, size.</li>
                                <li><b className="text-slate-300">Attendance data:</b> clock-in/out timestamps, location data (if geofencing is enabled), verification method used.</li>
                                <li><b className="text-slate-300">Biometric data (optional):</b> face images for verification purposes, only when the employee explicitly consents.</li>
                                <li><b className="text-slate-300">PIN data:</b> a hashed PIN stored for authentication, if the employee chooses PIN-based clock-in.</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Data</h2>
                            <ul className="space-y-2 list-disc list-inside">
                                <li>To provide attendance tracking and verification services.</li>
                                <li>To enforce geofencing rules set by your organisation.</li>
                                <li>To generate reports and audit logs for your organisation.</li>
                                <li>To process billing and subscription management via Stripe.</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">3. Biometric Data</h2>
                            <p>Face images are processed using AI-powered verification for authentication purposes only. We do not sell or share biometric data with third parties. Employees must provide explicit consent before any face data is collected. Employees may revoke consent and delete their face data at any time.</p>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">4. Data Retention</h2>
                            <p>Organisation administrators can configure data retention periods. When data retention periods expire, face images and verification logs are permanently deleted. Account data is retained until the account is deleted or the organisation is deactivated.</p>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">5. Data Sharing</h2>
                            <p className="mb-3">We do not sell personal data. We share data only with:</p>
                            <ul className="list-disc list-inside">
                                <li><b className="text-slate-300">Stripe:</b> for payment processing (billing email and subscription data only).</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">6. Your Rights</h2>
                            <p>You have the right to access, correct, or delete your personal data. Employees can delete their face data from the dashboard at any time. To request full account deletion, contact your organisation administrator.</p>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">7. Security</h2>
                            <p>All data is encrypted in transit and at rest. See our <Link href="/security" className="text-blue-400 hover:text-blue-300 transition-colors">Security page</Link> for details.</p>
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
                            <p>For privacy-related enquiries, please contact your organisation administrator or email us at <a href="mailto:privacy@clockinpro.autostrata.ai" className="text-blue-400 hover:text-blue-300 transition-colors">privacy@clockinpro.autostrata.ai</a>.</p>
                        </div>
                    </div>
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
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                    <p className="text-sm text-slate-600">© {new Date().getFullYear()} Clock-In Pro</p>
                </div>
            </footer>
        </div>
    );
}
