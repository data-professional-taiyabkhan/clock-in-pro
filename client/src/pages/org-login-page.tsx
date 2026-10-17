import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Building2, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthLayout, type AuthBrand } from "@/components/layout/auth-layout";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export interface PublicOrg extends AuthBrand {
  id: number;
  slug: string;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
}

export default function OrgLoginPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data: org, isLoading, error } = useQuery<PublicOrg>({
    queryKey: ["/api/org", slug],
    queryFn: () => apiRequest(`/api/org/${slug}`),
    retry: false,
    enabled: !!slug,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; organizationId: number }) =>
      apiRequest("/api/login", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
    onError: (err: Error) => {
      toast({ title: "Sign in failed", description: err.message.replace(/^\d+:\s*/, "") || "Invalid email or password", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="glow-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <AuthLayout icon={<AlertTriangle />} title="Organisation not found" subtitle={`Nothing is registered at /org/${slug}`}>
        <p className="text-center text-sm text-muted-foreground">Check the link your admin shared, or ask them to resend it.</p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/login">Admin sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      brand={org}
      icon={org.logoUrl ? undefined : <Building2 />}
      title={org.welcomeTitle || org.name}
      subtitle={org.welcomeMessage || "Sign in to clock in and see your shifts"}
      footer={
        <p>
          Admin?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in here
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loginMutation.mutate({ email, password, organizationId: org.id });
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" />
        </div>
        <Button type="submit" className="brand-gradient h-11 w-full rounded-xl text-white shadow-glow hover:opacity-95" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>
    </AuthLayout>
  );
}
