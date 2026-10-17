import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/auth-layout";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { SignupData } from "@shared/schema";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupData>({
    defaultValues: { orgName: "", slug: "", email: "", password: "", confirmPassword: "", firstName: "", lastName: "" },
  });
  const slug = watch("slug");

  const signupMutation = useMutation({
    mutationFn: async (data: SignupData) => apiRequest("/api/signup", { method: "POST", body: data }),
    onSuccess: async (result: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      toast({ title: "Welcome to Clock-In Pro", description: "Your organisation is ready. Your first month is free." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Signup failed", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const inputCls = "h-11 rounded-xl";

  return (
    <AuthLayout
      width="lg"
      title="Start your free month"
      subtitle="Full access for 30 days. Nothing is charged until day 31."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit((d) => signupMutation.mutate(d))} className="space-y-4">
        <Field label="Organisation name" error={errors.orgName?.message}>
          <Input
            className={inputCls}
            placeholder="Riverside Café Ltd"
            {...register("orgName", { required: "Organisation name is required" })}
            onChange={(e) => {
              setValue("orgName", e.target.value);
              setValue("slug", slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Your employee login link" error={errors.slug?.message}>
          <div className="flex items-center overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="shrink-0 border-r border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground">{window.location.host}/org/</span>
            <input
              className="h-11 w-full bg-transparent px-3 text-sm outline-none"
              placeholder="riverside-cafe"
              {...register("slug", {
                required: "Link is required",
                pattern: { value: /^[a-z0-9-]+$/, message: "Only lowercase letters, numbers and hyphens" },
              })}
            />
          </div>
          <p className="text-xs text-muted-foreground">Your staff will sign in at this address. You can customise its look later.</p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}>
            <Input className={inputCls} placeholder="Jane" {...register("firstName", { required: "Required" })} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input className={inputCls} placeholder="Smith" {...register("lastName", { required: "Required" })} />
          </Field>
        </div>
        <Field label="Admin email" error={errors.email?.message}>
          <Input className={inputCls} type="email" autoComplete="email" placeholder="jane@riverside.co.uk" {...register("email", { required: "Email is required" })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Password" error={errors.password?.message}>
            <Input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              placeholder="Min 8 characters"
              {...register("password", { required: "Password is required", minLength: { value: 8, message: "Min 8 characters" } })}
            />
          </Field>
          <Field label="Confirm password" error={errors.confirmPassword?.message}>
            <Input className={inputCls} type="password" autoComplete="new-password" placeholder="Repeat password" {...register("confirmPassword", { required: "Please confirm your password" })} />
          </Field>
        </div>

        <Button type="submit" className="brand-gradient h-11 w-full rounded-xl text-white shadow-glow hover:opacity-95" disabled={signupMutation.isPending}>
          {signupMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating your organisation…
            </>
          ) : (
            <>
              Continue to add a card <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <ul className="grid gap-1.5 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
          {["30 days free, full access", "Nothing charged until day 31", "Cancel before then and pay nothing", "Admin seats always free"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-success" /> {t}
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          {slug && <> Your link will be <span className="font-medium text-foreground">/org/{slug}</span>.</>}
        </p>
      </form>
    </AuthLayout>
  );
}
