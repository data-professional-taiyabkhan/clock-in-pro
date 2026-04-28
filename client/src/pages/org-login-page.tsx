import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Loader2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

/**
 * Organisation-specific login page.
 * Employees visit /org/acme-corp → see their org name + login form.
 */
export default function OrgLoginPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug || "";
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Fetch org info from slug
    const {
        data: org,
        isLoading: orgLoading,
        error: orgError,
    } = useQuery<{ id: number; name: string; slug: string }>({
        queryKey: ["/api/org", slug],
        queryFn: () => apiRequest(`/api/org/${slug}`),
        retry: false,
        enabled: !!slug,
    });

    // Login mutation
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

    // Loading state
    if (orgLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        );
    }

    // Org not found
    if (orgError || !org) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
                <Card className="w-full max-w-md shadow-xl border-0">
                    <CardContent className="pt-8 pb-6 text-center space-y-4">
                        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                        <h2 className="text-xl font-bold">Organisation not found</h2>
                        <p className="text-muted-foreground">
                            The link <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/org/{slug}</code> does not
                            match any registered organisation.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Check the URL or contact your admin.
                        </p>
                        <Link href="/login" className="text-blue-600 hover:underline text-sm font-medium">
                            Go to admin login →
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-0">
                <CardHeader className="text-center pb-2">
                    <div className="flex items-center justify-center mb-3">
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">{org.name}</CardTitle>
                    <CardDescription>Sign in to your employee account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5"
                            disabled={loginMutation.isPending}
                        >
                            {loginMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </Button>
                    </form>

                    <div className="mt-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Admin?{" "}
                            <Link href="/login" className="text-blue-600 hover:underline font-medium">
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
