import { redirect } from "next/navigation";

import { getUserArchives } from "@/lib/archives";
import { CreateArchiveForm } from "@/components/archive/CreateArchiveForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // If the user already belongs to an archive, skip onboarding.
  const archives = await getUserArchives();
  if (archives.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl py-4">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl text-stone-900 sm:text-4xl">
          Welcome to EverMoments
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-600">
          Let&apos;s start by creating your family archive — a private, safe home
          for your family&apos;s stories. You can invite family members once it&apos;s
          set up.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <CreateArchiveForm />
      </div>
    </div>
  );
}
