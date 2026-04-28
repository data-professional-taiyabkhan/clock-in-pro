import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { ShieldCheck, ArrowRight, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Extract token from URL query params
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

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }

    resetMutation.mutate({ token, newPassword: password });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                Invalid reset link. Please request a new password reset from the{" "}
                <Link href="/forgot-password" className="underline font-medium">
                  forgot password page
                </Link>.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-1 pb-2">
          <div className="flex items-center justify-center mb-3">
            <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Reset your password
          </CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Password reset successfully! Redirecting to login...
                </AlertDescription>
              </Alert>
              <div className="text-center">
                <Link href="/login" className="text-blue-600 hover:underline font-medium text-sm">
                  Go to sign in now
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Resetting..." : "Reset password"}
                {!resetMutation.isPending && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
