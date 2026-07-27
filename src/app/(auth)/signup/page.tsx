import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create account — EverMoments",
};

export default function SignupPage() {
  return (
    <div>
      <h1 className="mb-6 text-center font-heading text-2xl text-stone-800">
        Create your account
      </h1>
      <SignupForm />
    </div>
  );
}
