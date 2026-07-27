"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    // Honor a safe same-site redirect target set by the middleware.
    let dest = "/dashboard";
    if (typeof window !== "undefined") {
      const target = new URLSearchParams(window.location.search).get("redirect");
      if (target && target.startsWith("/") && !target.startsWith("//")) {
        dest = target;
      }
    }
    router.push(dest);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={errors.email?.message}
        {...register("email")}
      />

      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 text-warm-500 focus:ring-warm-300"
            {...register("rememberMe")}
          />
          Remember me
        </label>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-warm-700 hover:text-warm-800"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Sign in
      </Button>

      <p className="text-center text-sm text-stone-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-warm-700 hover:text-warm-800">
          Create one
        </Link>
      </p>
    </form>
  );
}
