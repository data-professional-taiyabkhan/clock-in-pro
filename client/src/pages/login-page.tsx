import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/layout/auth-layout";
import { loginSchema, type LoginData } from "@shared/schema";
import { login } from "@/lib/api";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const form = useForm<LoginData>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => login(data.email, data.password),
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      setLocation("/");
    },
    onError: (err: Error) => setError(err.message.replace(/^\d+:\s*/, "")),
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your admin account"
      footer={
        <>
          <p>
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Start your free month
            </Link>
          </p>
          <p className="mt-2 text-xs">Employee? Use the organisation link your admin shared with you.</p>
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit((data) => {
          setError("");
          loginMutation.mutate(data);
        })}
        className="space-y-5"
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className="h-11 rounded-xl" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="Your password" className="h-11 rounded-xl" {...form.register("password")} />
          {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
        </div>
        <Button type="submit" className="brand-gradient h-11 w-full rounded-xl text-white shadow-glow hover:opacity-95" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>
    </AuthLayout>
  );
}
