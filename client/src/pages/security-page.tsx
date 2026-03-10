import { Link } from "wouter";
import { Clock, Shield, Lock, Server, Eye, Trash2, Database } from "lucide-react";

export default function SecurityPage() {
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
                    <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                        <Link href="/pricing" className="hover:text-blue-600">Pricing</Link>
                        <Link href="/login" className="hover:text-blue-600">Sign in</Link>
                    </div>
                </div>
            </nav>

            <section className="pt-16 pb-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Security & Data Protection</h1>
                    <p className="text-lg text-slate-600 mb-12">
                        Clock-In Pro is built with security and privacy as foundational principles, not afterthoughts.
                    </p>

                    <div className="space-y-10">
                        <Section icon={Lock} title="Encryption">
                            <p>All data is encrypted in transit via TLS 1.2+ and at rest using AES-256. Database connections use SSL with certificate verification.</p>
                        </Section>

                        <Section icon={Shield} title="Biometric Data Handling">
                            <p>Face images are stored securely with server-side encryption. Face verification uses AI-powered matching — biometric templates are never exposed to client devices.</p>
                            <p className="mt-2">Employees can <b>opt out of biometrics entirely</b> and use a secure PIN instead. Consent is recorded with timestamps, policy versioning, and IP address.</p>
                        </Section>

                        <Section icon={Eye} title="Consent & Transparency">
                            <p>Before face data is collected, employees must provide explicit opt-in consent. The consent record includes the policy version, timestamp, and user agent. Consent can be revoked at any time.</p>
                        </Section>

                        <Section icon={Trash2} title="Right to Delete">
                            <p>Any employee can delete their face data from their dashboard at any time. Once deleted, the face image and embeddings are permanently removed from both S3 and the database.</p>
                        </Section>

                        <Section icon={Database} title="Data Retention">
                            <p>Administrators can configure data retention periods per organisation. Face images and verification logs are automatically purged after the configured retention period.</p>
                        </Section>

                        <Section icon={Server} title="Infrastructure">
                            <p>Clock-In Pro runs on hardened cloud infrastructure with automatic patching. The database is hosted on managed PostgreSQL with automated backups.</p>
                            <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc list-inside">
                                <li>Encrypted face image storage (server-side encryption)</li>
                                <li>AI-powered face verification</li>
                                <li>PostgreSQL database (encrypted storage)</li>
                                <li>Session-based authentication with secure HTTP-only cookies</li>
                            </ul>
                        </Section>

                        <Section icon={Shield} title="Multi-Tenant Isolation">
                            <p>Every database query is scoped by organisationId. There is no mechanism for one organisation to access another's data. Each organisation has its own dashboards, settings, and employee data.</p>
                        </Section>
                    </div>
                </div>
            </section>

            <footer className="py-12 px-6 bg-slate-900 text-slate-400 text-sm">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <span className="font-semibold text-white">Clock-In Pro</span>
                    <div className="flex gap-6">
                        <Link href="/" className="hover:text-white">Home</Link>
                        <Link href="/privacy" className="hover:text-white">Privacy</Link>
                        <Link href="/terms" className="hover:text-white">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            </div>
            <div className="text-slate-600 leading-relaxed">{children}</div>
        </div>
    );
}
