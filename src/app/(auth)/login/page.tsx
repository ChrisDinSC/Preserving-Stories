import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — EverMoments",
};

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-6 text-center font-heading text-2xl text-stone-800">
        Welcome back
      </h1>
      <LoginForm />
    </div>
  );
}
