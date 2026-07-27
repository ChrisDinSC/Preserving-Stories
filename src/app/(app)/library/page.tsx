import Link from "next/link";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { requireActiveArchive } from "@/lib/require-archive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library — EverMoments" };

export default async function LibraryPage() {
  // Redirects to /onboarding if the user has no archive.
  await requireActiveArchive();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl text-stone-800">Library</h1>
        <p className="mt-1 text-stone-600">
          Browse, search, and organize every story in your archive.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-100">
          <BookOpen size={28} className="text-warm-600" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-heading text-xl text-stone-700">
          No stories yet
        </h2>
        <p className="mt-1 max-w-md text-sm text-stone-500">
          When you record and publish stories, they&apos;ll appear here where you can
          search by title, storyteller, people, and tags.
        </p>
        <Link href="/record" className="mt-5">
          <Button>Record a story</Button>
        </Link>
      </div>
    </div>
  );
}
