"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/utils";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${getAppUrl()}/login`,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-xl border border-forest-200 bg-forest-50 px-5 py-6 text-center"
      >
        <h2 className="font-heading text-xl text-forest-800">Check your email</h2>
        <p className="mt-2 text-sm text-forest-700">
          If an account exists for that address, we&apos;ve sent a link to reset your
          password.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm font-medium text-warm-700 hover:text-warm-800"
        >
          Back to sign in
        </Link>
      </div>
    );
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

      <Button type="submit" className="w-full" isLoading={isSubmitting}>
        Send reset link
      </Button>

      <p className="text-center text-sm text-stone-600">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-warm-700 hover:text-warm-800">
          Sign in
        </Link>
      </p>
    </form>
  );
}
