import { Link } from "wouter";
import { Clock, Shield, Lock, Server, Eye, Trash2, Database, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-xl flex items-center justify-center border border-white/10">
                    <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
            </div>
            <div className="text-slate-400 leading-relaxed text-sm space-y-2">{children}</div>
        </div>
    );
}

export default function SecurityPage() {
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
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
                        <Link href="/signup">
                            <Button size="sm" className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white rounded-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02]">
                                Start free trial <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-20 pb-12 px-6 text-center relative">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-gradient-to-b from-blue-600/10 to-transparent rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 max-w-2xl mx-auto">
                    <span className="text-sm font-semibold text-blue-400 uppercase tracking-widest">Security</span>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-3 mb-4">
                        Security &amp; <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Data Protection</span>
                    </h1>
                    <p className="text-lg text-slate-400">
                        Clock-In Pro is built with security and privacy as foundational principles, not afterthoughts.
                    </p>
                </div>
            </section>

            {/* Content */}
            <section className="pb-24 px-6">
                <div className="max-w-3xl mx-auto space-y-5">
                    <Section icon={Lock} title="Encryption">
                        <p>All data is encrypted in transit via TLS 1.2+ and at rest using AES-256. Database connections use SSL with certificate verification.</p>
                    </Section>

                    <Section icon={Shield} title="Biometric Data Handling">
                        <p>Face images are stored securely with server-side encryption. Face verification uses AI-powered matching — biometric templates are never exposed to client devices.</p>
                        <p>Employees can <b className="text-white">opt out of biometrics entirely</b> and use a secure PIN instead. Consent is recorded with timestamps, policy versioning, and IP address.</p>
                    </Section>

                    <Section icon={Eye} title="Consent & Transparency">
                        <p>Before face data is collected, employees must provide explicit opt-in consent. The consent record includes the policy version, timestamp, and user agent. Consent can be revoked at any time.</p>
                    </Section>

                    <Section icon={Trash2} title="Right to Delete">
                        <p>Any employee can delete their face data from their dashboard at any time. Once deleted, the face image and embeddings are permanently removed from both storage and the database.</p>
                    </Section>

                    <Section icon={Database} title="Data Retention">
                        <p>Administrators can configure data retention periods per organisation. Face images and verification logs are automatically purged after the configured retention period.</p>
                    </Section>

                    <Section icon={Server} title="Infrastructure">
                        <p>Clock-In Pro runs on hardened cloud infrastructure with automatic patching. The database is hosted on managed PostgreSQL with automated backups.</p>
                        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
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
                        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                    </div>
                    <p className="text-sm text-slate-600">© {new Date().getFullYear()} Clock-In Pro</p>
                </div>
            </footer>
        </div>
    );
}
