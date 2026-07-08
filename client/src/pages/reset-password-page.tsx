import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { Clock, ShieldCheck, ArrowRight, CheckCircle } from "lucide-react";

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4 relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-violet-600/10 rounded-full blur-[80px]" />
    </div>
    <div className="w-full max-w-md relative z-10 animate-[fadeInUp_0.6s_ease-out]">
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
      </div>
      {children}
    </div>
  </div>
);

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const resetMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) =>
      apiRequest("/api/password/reset", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 3000);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to reset password");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    if (!token) { setError("Missing reset token. Please use the link from your email."); return; }
    resetMutation.mutate({ token, newPassword: password });
  };


  if (!token) {
    return (
      <Wrapper>
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
          <Alert className="bg-red-500/10 border-red-500/20">
            <AlertDescription className="text-red-300">
              Invalid reset link. Please request a new password reset from the{" "}
              <Link href="/forgot-password" className="underline font-medium text-red-200">
                forgot password page
              </Link>.
            </AlertDescription>
          </Alert>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 h-14 w-14 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-2xl flex items-center justify-center border border-white/10">
          <ShieldCheck className="h-7 w-7 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
        <p className="text-slate-400 text-sm">Enter your new password below</p>
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
        {success ? (
          <div className="space-y-4">
            <Alert className="border-green-500/20 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
                Password reset successfully! Redirecting to login...
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors">
                Go to sign in now
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <Alert className="bg-red-500/10 border-red-500/20">
                <AlertDescription className="text-red-300">{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-slate-300 text-sm">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password" className="text-slate-300 text-sm">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-medium py-3 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-blue-500/30 hover:scale-[1.01]"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Resetting..." : "Reset password"}
              {!resetMutation.isPending && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </form>
        )}
      </div>
    </Wrapper>
  );
}
