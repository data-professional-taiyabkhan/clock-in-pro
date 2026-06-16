import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Building2, CheckCircle, ArrowRight } from "lucide-react";
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
        defaultValues: {
            orgName: "",
            slug: "",
            email: "",
            password: "",
            confirmPassword: "",
            firstName: "",
            lastName: "",
        },
    });

    const orgName = watch("orgName");

    const signupMutation = useMutation({
        mutationFn: async (data: SignupData) =>
            apiRequest("/api/signup", {
                method: "POST",
                body: data,
            }),
        onSuccess: () => {
            toast({
                title: "Welcome to Clock-In Pro!",
                description: "Your organisation has been created with a 14-day free trial.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            setLocation("/");
        },
        onError: (error: Error) => {
            toast({
                title: "Signup failed",
                description: error.message || "Please try again",
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: SignupData) => {
        signupMutation.mutate(data);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4 py-12 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-lg relative z-10 animate-[fadeInUp_0.6s_ease-out]">
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
                    <h1 className="text-2xl font-bold text-white mb-1">Start your free trial</h1>
                    <p className="text-slate-400 text-sm">14 days free — no credit card required</p>
                </div>

                {/* Card */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Organisation name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="orgName" className="text-slate-300 text-sm">Organisation name</Label>
                            <Input
                                id="orgName"
                                {...register("orgName", { required: "Organisation name is required" })}
                                placeholder="Acme Corp"
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setValue("orgName", val);
                                    setValue("slug", slugify(val));
                                }}
                            />
                            {errors.orgName && <p className="text-sm text-red-400">{errors.orgName.message}</p>}
                        </div>

                        {/* Slug */}
                        <div className="space-y-1.5">
                            <Label htmlFor="slug" className="text-slate-300 text-sm">Organisation URL slug</Label>
                            <div className="flex items-center gap-1 text-sm">
                                <span className="text-slate-500 shrink-0">clockinpro.com/</span>
                                <Input
                                    id="slug"
                                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                                    {...register("slug", {
                                        required: "Slug is required",
                                        pattern: { value: /^[a-z0-9-]+$/, message: "Only lowercase letters, numbers, hyphens" },
                                    })}
                                    placeholder="acme-corp"
                                />
                            </div>
                            {errors.slug && <p className="text-sm text-red-400">{errors.slug.message}</p>}
                        </div>

                        {/* Name fields */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="firstName" className="text-slate-300 text-sm">First name</Label>
                                <Input
                                    id="firstName"
                                    {...register("firstName", { required: "Required" })}
                                    placeholder="Jane"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                                />
                                {errors.firstName && <p className="text-sm text-red-400">{errors.firstName.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="lastName" className="text-slate-300 text-sm">Last name</Label>
                                <Input
                                    id="lastName"
                                    {...register("lastName", { required: "Required" })}
                                    placeholder="Smith"
                                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                                />
                                {errors.lastName && <p className="text-sm text-red-400">{errors.lastName.message}</p>}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-slate-300 text-sm">Admin email</Label>
                            <Input
                                id="email"
                                type="email"
                                {...register("email", { required: "Email is required" })}
                                placeholder="jane@acme.com"
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                            />
                            {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                {...register("password", { required: "Password is required", minLength: { value: 8, message: "Min 8 characters" } })}
                                placeholder="Min 8 characters"
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                            />
                            {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
                        </div>

                        {/* Confirm password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword" className="text-slate-300 text-sm">Confirm password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                {...register("confirmPassword", { required: "Please confirm your password" })}
                                placeholder="Repeat password"
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 h-11 rounded-xl"
                            />
                            {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>}
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-medium py-3 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-blue-500/30 hover:scale-[1.01]"
                            disabled={signupMutation.isPending}
                        >
                            {signupMutation.isPending ? "Creating your organisation..." : "Start free trial"}
                            {!signupMutation.isPending && <ArrowRight className="h-4 w-4 ml-2" />}
                        </Button>
                    </form>

                    <div className="mt-5 text-center space-y-2">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            No credit card required
                        </div>
                        <p className="text-sm text-slate-400">
                            Already have an account?{" "}
                            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
