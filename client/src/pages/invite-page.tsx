import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { AlertTriangle, ArrowRight, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/layout/auth-layout";
import { apiRequest } from "@/lib/queryClient";
import { cleanError } from "@/lib/types";

interface InviteInfo {
  email: string;
  role: string;
  organisation: { name: string; slug: string; logoUrl?: string | null; brandColor?: string | null };
  invitedBy?: string | null;
  expired: boolean;
  used: boolean;
}

export default function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const { data: info, isLoading, error: loadError } = useQuery<InviteInfo>({
    queryKey: ["/api/invitations/by-token", token],
    queryFn: () => apiRequest(`/api/invitations/by-token/${token}`),
    retry: false,
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: async () => apiRequest("/api/register-with-token", { method: "POST", body: { token, firstName, lastName, password } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
    onError: (e) => setError(cleanError(e)),
  });

  if (isLoading) {
    return (
      <div className="glow-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !info || info.expired || info.used) {
    return (
      <AuthLayout icon={<AlertTriangle />} title="This invitation can't be used" subtitle={info?.used ? "It has already been accepted." : "It is invalid or has expired."}>
        <p className="text-center text-sm text-muted-foreground">Ask your admin to send a new invitation.</p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/">Back to home</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      brand={{ name: info.organisation.name, logoUrl: info.organisation.logoUrl, brandColor: info.organisation.brandColor }}
      icon={info.organisation.logoUrl ? undefined : <UserPlus />}
      title={`Join ${info.organisation.name}`}
      subtitle={info.invitedBy ? `${info.invitedBy} invited you as ${info.role === "admin" ? "an admin" : "an employee"}` : `You've been invited as ${info.role === "admin" ? "an admin" : "an employee"}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (password.length < 8) return setError("Password must be at least 8 characters");
          if (password !== confirm) return setError("Passwords don't match");
          accept.mutate();
        }}
        className="space-y-4"
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={info.email} disabled className="h-11 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-11 rounded-xl" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Choose a password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" placeholder="Min 8 characters" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-11 rounded-xl" />
        </div>
        <Button type="submit" className="brand-gradient h-11 w-full rounded-xl text-white shadow-glow hover:opacity-95" disabled={accept.isPending}>
          {accept.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create my account <ArrowRight className="h-4 w-4" /></>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the <Link href="/terms" className="text-primary hover:underline">Terms</Link> and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
