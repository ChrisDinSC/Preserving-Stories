import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password — EverMoments",
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-2 text-center font-heading text-2xl text-stone-800">
        Reset your password
      </h1>
      <p className="mb-6 text-center text-sm text-stone-600">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
