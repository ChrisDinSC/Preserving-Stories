import Link from "next/link";
import { BookOpen, FileText, Users, Mic } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const stats = [
  { label: "Stories", value: 0, Icon: BookOpen, tint: "text-warm-600" },
  { label: "Drafts", value: 0, Icon: FileText, tint: "text-stone-500" },
  { label: "Archive members", value: 1, Icon: Users, tint: "text-forest-600" },
];

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-warm-50/60 px-6 py-10 text-center">
      <p className="font-heading text-lg text-stone-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-4">
          <Button variant="secondary" size="sm">
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? "there";
  const firstName = fullName.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl text-stone-800">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-stone-600">
            Preserve a new memory or revisit your family&apos;s stories.
          </p>
        </div>
        <Link href="/record">
          <Button size="lg" className="w-full sm:w-auto">
            <Mic size={20} aria-hidden="true" />
            Record a New Story
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, Icon, tint }) => (
          <Card key={label}>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-100">
                <Icon size={24} className={tint} aria-hidden="true" />
              </span>
              <div>
                <p className="text-3xl font-semibold text-stone-800">{value}</p>
                <p className="text-sm text-stone-500">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Continue drafts</CardTitle>
          <Link
            href="/library"
            className="text-sm font-medium text-warm-700 hover:text-warm-800"
          >
            View all
          </Link>
        </div>
        <EmptyState
          title="No drafts yet"
          description="Stories you start but haven't published will appear here so you can pick up where you left off."
          actionHref="/record"
          actionLabel="Start a story"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Recent stories</CardTitle>
          <Link
            href="/library"
            className="text-sm font-medium text-warm-700 hover:text-warm-800"
          >
            View library
          </Link>
        </div>
        <EmptyState
          title="Your library is empty"
          description="Once you record and publish stories, the most recent ones will show up here."
          actionHref="/record"
          actionLabel="Record your first story"
        />
      </section>
    </div>
  );
}
