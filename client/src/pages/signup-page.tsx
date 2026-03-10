import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle } from "lucide-react";
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-xl border-0">
                <CardHeader className="text-center pb-2">
                    <div className="flex items-center justify-center mb-3">
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">Start your free trial</CardTitle>
                    <CardDescription>
                        14 days free — no credit card required
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Organisation name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="orgName">Organisation name</Label>
                            <Input
                                id="orgName"
                                {...register("orgName", { required: "Organisation name is required" })}
                                placeholder="Acme Corp"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setValue("orgName", val);
                                    setValue("slug", slugify(val));
                                }}
                            />
                            {errors.orgName && <p className="text-sm text-red-500">{errors.orgName.message}</p>}
                        </div>

                        {/* Slug */}
                        <div className="space-y-1.5">
                            <Label htmlFor="slug">Organisation URL slug</Label>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <span>clockinpro.com/</span>
                                <Input
                                    id="slug"
                                    className="flex-1"
                                    {...register("slug", {
                                        required: "Slug is required",
                                        pattern: { value: /^[a-z0-9-]+$/, message: "Only lowercase letters, numbers, hyphens" },
                                    })}
                                    placeholder="acme-corp"
                                />
                            </div>
                            {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
                        </div>

                        {/* Name fields side by side */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="firstName">First name</Label>
                                <Input
                                    id="firstName"
                                    {...register("firstName", { required: "Required" })}
                                    placeholder="Jane"
                                />
                                {errors.firstName && <p className="text-sm text-red-500">{errors.firstName.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input
                                    id="lastName"
                                    {...register("lastName", { required: "Required" })}
                                    placeholder="Smith"
                                />
                                {errors.lastName && <p className="text-sm text-red-500">{errors.lastName.message}</p>}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Admin email</Label>
                            <Input
                                id="email"
                                type="email"
                                {...register("email", { required: "Email is required" })}
                                placeholder="jane@acme.com"
                            />
                            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                {...register("password", { required: "Password is required", minLength: { value: 8, message: "Min 8 characters" } })}
                                placeholder="Min 8 characters"
                            />
                            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                        </div>

                        {/* Confirm password */}
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword">Confirm password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                {...register("confirmPassword", { required: "Please confirm your password" })}
                                placeholder="Repeat password"
                            />
                            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5"
                            disabled={signupMutation.isPending}
                        >
                            {signupMutation.isPending ? "Creating your organisation..." : "Start free trial"}
                        </Button>
                    </form>

                    <div className="mt-4 text-center space-y-2">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            No credit card required
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-blue-600 hover:underline font-medium">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
