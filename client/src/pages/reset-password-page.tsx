import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/layout/auth-layout";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const token = new URLSearchParams(window.location.search).get("token");

  const resetMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => apiRequest("/api/password/reset", { method: "POST", body: data }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 2500);
    },
    onError: (err: Error) => setError(err.message.replace(/^\d+:\s*/, "") || "Failed to reset password"),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirmPassword) return setError("Passwords don't match");
    if (!token) return setError("Missing reset token. Please use the link from your email.");
    resetMutation.mutate({ token, newPassword: password });
  };

  return (
    <AuthLayout
      icon={<ShieldCheck />}
      title={success ? "Password updated" : "Choose a new password"}
      subtitle={success ? "Taking you to sign in…" : "Use at least 8 characters"}
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!token ? (
        <Alert variant="destructive">
          <AlertDescription>This reset link is missing its token. Please use the link from your email, or request a new one.</AlertDescription>
        </Alert>
      ) : success ? (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription>Your password has been reset. You can now sign in.</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-11 rounded-xl" />
          </div>
          <Button type="submit" className="brand-gradient h-11 w-full rounded-xl text-white hover:opacity-95" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Reset password <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
