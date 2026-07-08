import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock, Building2, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

const DarkBg = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-violet-600/10 rounded-full blur-[80px]" />
        </div>
        <div className="w-full max-w-md relative z-10 animate-[fadeInUp_0.6s_ease-out]">
            {children}
        </div>
    </div>
);

export default function OrgLoginPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug || "";
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const { data: org, isLoading: orgLoading, error: orgError } = useQuery<{ id: number; name: string; slug: string }>({
        queryKey: ["/api/org", slug],
        queryFn: () => apiRequest(`/api/org/${slug}`),
        retry: false,
        enabled: !!slug,
    });

    const loginMutation = useMutation({
        mutationFn: async (data: { email: string; password: string; organizationId: number }) =>
            apiRequest("/api/login", {
                method: "POST",
                body: JSON.stringify(data),
                headers: { "Content-Type": "application/json" },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            setLocation("/");
        },
        onError: (error: Error) => {
            toast({
                title: "Login failed",
                description: error.message || "Invalid email or password",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!org) return;
        loginMutation.mutate({ email, password, organizationId: org.id });
    };


    if (orgLoading) {
        return (
            <DarkBg>
                <div className="flex justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                </div>
            </DarkBg>
        );
    }

    if (orgError || !org) {
        return (
            <DarkBg>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm text-center space-y-4">
                    <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
                    <h2 className="text-xl font-bold text-white">Organisation not found</h2>
                    <p className="text-slate-400 text-sm">
                        The link <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-slate-300">/org/{slug}</code> does not match any registered organisation.
                    </p>
                    <p className="text-sm text-slate-500">Check the URL or contact your admin.</p>
                    <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                        Go to admin login →
                    </Link>
                </div>
            </DarkBg>
        );
    }

    return (
        <DarkBg>
            {/* Header */}
            <div className="text-center mb-8">
                <Link href="/">
                    <div className="inline-flex items-center gap-2.5 mb-6 cursor-pointer group">
                        <div className="h-11 w-11 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                            <Clock className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                            Clock-In Pro
                        </span>
                    </div>
                </Link>
                <div className="mx-auto mb-4 h-14 w-14 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-2xl flex items-center justify-center border border-white/10">
                    <Building2 className="h-7 w-7 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">{org.name}</h1>
                <p className="text-slate-400 text-sm">Sign in to your employee account</p>
            </div>

            {/* Card */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-medium py-3 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-blue-500/30 hover:scale-[1.01]"
                        disabled={loginMutation.isPending}
                    >
                        {loginMutation.isPending ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</>
                        ) : (
                            <>Sign in <ArrowRight className="h-4 w-4 ml-2" /></>
                        )}
                    </Button>
                </form>

                <div className="mt-5 text-center">
                    <p className="text-sm text-slate-400">
                        Admin?{" "}
                        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>
        </DarkBg>
    );
}
