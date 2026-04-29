import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { KeyRound, ArrowLeft, CheckCircle, Clock } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: async (email: string) =>
      apiRequest("/api/password/forgot", {
        method: "POST",
        body: { email },
      }),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      forgotMutation.mutate(email.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-violet-600/10 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-[fadeInUp_0.6s_ease-out]">
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
            <KeyRound className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Forgot password?</h1>
          <p className="text-slate-400 text-sm">Enter your email and we'll send you a reset link</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
          {submitted ? (
            <div className="space-y-4">
              <Alert className="border-green-500/20 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300">
                  If an account with that email exists, we've sent a reset link.
                  Check your inbox (and spam folder).
                </AlertDescription>
              </Alert>
              <div className="text-center">
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium text-sm inline-flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="space-y-5">
                {forgotMutation.isError && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-300">
                    <AlertDescription>
                      {forgotMutation.error?.message || "Something went wrong. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-slate-300 text-sm">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20 h-11 rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-medium py-3 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-blue-500/30 hover:scale-[1.01]"
                  disabled={forgotMutation.isPending}
                >
                  {forgotMutation.isPending ? "Sending..." : "Send reset link"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-slate-400 hover:text-slate-300 inline-flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
