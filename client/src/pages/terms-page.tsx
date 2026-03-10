import { Link } from "wouter";
import { Clock } from "lucide-react";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white">
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Clock-In Pro</span>
                    </Link>
                </div>
            </nav>

            <section className="pt-16 pb-20 px-6">
                <div className="max-w-3xl mx-auto prose prose-slate">
                    <h1>Terms of Service</h1>
                    <p className="text-sm text-slate-500">Last updated: March 2026</p>

                    <h2>1. Service Description</h2>
                    <p>Clock-In Pro provides cloud-based employee attendance tracking with optional face verification and geofencing. The service is provided on a subscription basis.</p>

                    <h2>2. Free Trial</h2>
                    <p>New organisations receive a 14-day free trial with access to all features. No credit card is required to start a trial. After the trial period, a paid subscription is required to continue using the service.</p>

                    <h2>3. Subscriptions & Billing</h2>
                    <ul>
                        <li>Subscriptions are billed based on the number of active employees (role: employee, status: active).</li>
                        <li>Admin and manager accounts are not counted for billing purposes.</li>
                        <li>Monthly plan: £3.50 per active employee per month.</li>
                        <li>Annual plan: £3.00 per active employee per month, billed annually.</li>
                        <li>Employee counts are automatically adjusted on a daily basis. Prorated charges apply for mid-period changes.</li>
                        <li>Payments are processed by Stripe. You can manage your subscription, download invoices, and update payment methods via the Stripe customer portal.</li>
                    </ul>

                    <h2>4. Cancellation</h2>
                    <p>You may cancel your subscription at any time from the Stripe customer portal. Your access will continue until the end of the current billing period. No refunds are provided for partial periods.</p>

                    <h2>5. Data & Privacy</h2>
                    <p>Your use of the service is subject to our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>. Each organisation's data is isolated and cannot be accessed by other organisations.</p>

                    <h2>6. Biometric Data</h2>
                    <p>Face verification is optional. Employees must provide explicit consent before biometric data is collected. Employees may opt out at any time without penalty by switching to PIN-based authentication.</p>

                    <h2>7. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the service for any unlawful purpose.</li>
                        <li>Attempt to access another organisation's data.</li>
                        <li>Reverse-engineer or attempt to extract source code from the service.</li>
                        <li>Use automated means to access the service beyond normal API usage.</li>
                    </ul>

                    <h2>8. Limitation of Liability</h2>
                    <p>The service is provided "as is" without warranty of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the service.</p>

                    <h2>9. Changes to Terms</h2>
                    <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>

                    <h2>10. Contact</h2>
                    <p>For questions about these terms, contact legal@clockinpro.com.</p>
                </div>
            </section>

            <footer className="py-12 px-6 bg-slate-900 text-slate-400 text-sm">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <span className="font-semibold text-white">Clock-In Pro</span>
                    <div className="flex gap-6">
                        <Link href="/" className="hover:text-white">Home</Link>
                        <Link href="/security" className="hover:text-white">Security</Link>
                        <Link href="/privacy" className="hover:text-white">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
