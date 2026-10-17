import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/layout/auth-layout";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: async (email: string) => apiRequest("/api/password/forgot", { method: "POST", body: { email } }),
    onSuccess: () => setSubmitted(true),
  });

  return (
    <AuthLayout
      icon={<KeyRound />}
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link"
      footer={
        <Link href="/login" className="inline-flex items-center gap-1 text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {submitted ? (
        <Alert className="border-success/30 bg-success/10">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription>If an account with that email exists, we've sent a reset link. Check your inbox and spam folder.</AlertDescription>
        </Alert>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) forgotMutation.mutate(email.trim());
          }}
          className="space-y-5"
        >
          {forgotMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{forgotMutation.error?.message || "Something went wrong. Please try again."}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input id="forgot-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" />
          </div>
          <Button type="submit" className="brand-gradient h-11 w-full rounded-xl text-white hover:opacity-95" disabled={forgotMutation.isPending}>
            {forgotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
