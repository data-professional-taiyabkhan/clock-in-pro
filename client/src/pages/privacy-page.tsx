import { Link } from "wouter";
import { Clock } from "lucide-react";

export default function PrivacyPage() {
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
                    <h1>Privacy Policy</h1>
                    <p className="text-sm text-slate-500">Last updated: March 2026</p>

                    <h2>1. Data We Collect</h2>
                    <p>We collect the following personal data when you use Clock-In Pro:</p>
                    <ul>
                        <li><b>Account data:</b> name, email address, hashed password.</li>
                        <li><b>Organisation data:</b> organisation name, slug, industry, size.</li>
                        <li><b>Attendance data:</b> clock-in/out timestamps, location data (if geofencing is enabled), verification method used.</li>
                        <li><b>Biometric data (optional):</b> face images for verification purposes, only when the employee explicitly consents.</li>
                        <li><b>PIN data:</b> a hashed PIN stored for authentication, if the employee chooses PIN-based clock-in.</li>
                    </ul>

                    <h2>2. How We Use Your Data</h2>
                    <ul>
                        <li>To provide attendance tracking and verification services.</li>
                        <li>To enforce geofencing rules set by your organisation.</li>
                        <li>To generate reports and audit logs for your organisation.</li>
                        <li>To process billing and subscription management via Stripe.</li>
                    </ul>

                    <h2>3. Biometric Data</h2>
                    <p>Face images are processed using AI-powered verification for authentication purposes only. We do not sell or share biometric data with third parties. Employees must provide explicit consent before any face data is collected. Employees may revoke consent and delete their face data at any time.</p>

                    <h2>4. Data Retention</h2>
                    <p>Organisation administrators can configure data retention periods. When data retention periods expire, face images and verification logs are permanently deleted. Account data is retained until the account is deleted or the organisation is deactivated.</p>

                    <h2>5. Data Sharing</h2>
                    <p>We do not sell personal data. We share data only with:</p>
                    <ul>
                        <li><b>Stripe:</b> for payment processing (billing email and subscription data only).</li>
                    </ul>

                    <h2>6. Your Rights</h2>
                    <p>You have the right to access, correct, or delete your personal data. Employees can delete their face data from the dashboard at any time. To request full account deletion, contact your organisation administrator.</p>

                    <h2>7. Security</h2>
                    <p>All data is encrypted in transit and at rest. See our <Link href="/security" className="text-blue-600 hover:underline">Security page</Link> for details.</p>

                    <h2>8. Contact</h2>
                    <p>For privacy-related enquiries, please contact your organisation administrator or email us at privacy@clockinpro.com.</p>
                </div>
            </section>

            <footer className="py-12 px-6 bg-slate-900 text-slate-400 text-sm">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <span className="font-semibold text-white">Clock-In Pro</span>
                    <div className="flex gap-6">
                        <Link href="/" className="hover:text-white">Home</Link>
                        <Link href="/security" className="hover:text-white">Security</Link>
                        <Link href="/terms" className="hover:text-white">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
