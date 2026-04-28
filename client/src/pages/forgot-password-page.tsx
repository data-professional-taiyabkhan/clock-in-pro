import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { KeyRound, ArrowLeft, CheckCircle } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-1 pb-2">
          <div className="flex items-center justify-center mb-3">
            <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
              <KeyRound className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Forgot password?
          </CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  If an account with that email exists, we've sent a reset link.
                  Check your inbox (and spam folder).
                </AlertDescription>
              </Alert>
              <div className="text-center">
                <Link href="/login" className="text-blue-600 hover:underline font-medium text-sm inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="space-y-4">
                {forgotMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {forgotMutation.error?.message || "Something went wrong. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5"
                  disabled={forgotMutation.isPending}
                >
                  {forgotMutation.isPending ? "Sending..." : "Send reset link"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
