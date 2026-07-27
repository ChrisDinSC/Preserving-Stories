import { Archive as ArchiveIcon, Users, Calendar, Crown } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveArchive } from "@/lib/require-archive";
import {
  getArchiveDetail,
  getArchiveMembers,
  getPendingInvitations,
} from "@/lib/archives";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EditArchiveForm } from "@/components/archive/EditArchiveForm";
import { MembersManager } from "@/components/archive/MembersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archive — EverMoments" };

function roleBadgeVariant(role: string): "forest" | "warm" | "neutral" {
  if (role === "owner") return "forest";
  if (role === "contributor") return "warm";
  return "neutral";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ArchivePage() {
  // Redirects to /onboarding if the user has no archive.
  const { archive } = await requireActiveArchive();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [detail, members] = await Promise.all([
    getArchiveDetail(archive.id),
    getArchiveMembers(archive.id),
  ]);

  if (!detail || !user) {
    // Membership disappeared between guard and detail fetch — start over.
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl text-stone-800">Archive</h1>
        <p className="text-stone-600">
          We couldn&apos;t load this archive. Please refresh and try again.
        </p>
      </div>
    );
  }

  const isOwner = detail.role === "owner";
  const pendingInvitations = isOwner
    ? await getPendingInvitations(archive.id)
    : [];

  const ownerName = detail.owner?.full_name ?? "Unknown";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl text-stone-800">Archive</h1>
        <p className="mt-1 text-stone-600">
          Manage your family archive and the people you share it with.
        </p>
      </div>

      {/* Archive details */}
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warm-100">
              <ArchiveIcon size={24} className="text-warm-600" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-2xl">{detail.archive.name}</CardTitle>
                <Badge variant={roleBadgeVariant(detail.role)}>
                  {detail.role.charAt(0).toUpperCase() + detail.role.slice(1)}
                </Badge>
              </div>
              {detail.archive.description ? (
                <p className="mt-2 max-w-prose text-stone-600">
                  {detail.archive.description}
                </p>
              ) : (
                <p className="mt-2 text-stone-400">No description yet.</p>
              )}

              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-stone-600">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-forest-600" aria-hidden />
                  <dt className="sr-only">Owner</dt>
                  <dd>{ownerName}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-forest-600" aria-hidden />
                  <dt className="sr-only">Members</dt>
                  <dd>
                    {detail.memberCount}{" "}
                    {detail.memberCount === 1 ? "member" : "members"}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-stone-400" aria-hidden />
                  <dt className="sr-only">Created</dt>
                  <dd>Created {formatDate(detail.archive.created_at)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {isOwner ? (
            <div className="shrink-0">
              <EditArchiveForm
                archiveId={detail.archive.id}
                initialName={detail.archive.name}
                initialDescription={detail.archive.description ?? ""}
              />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Members + invitations */}
      <Card>
        <MembersManager
          archiveId={detail.archive.id}
          currentUserId={user.id}
          isOwner={isOwner}
          members={members}
          pendingInvitations={pendingInvitations}
        />
      </Card>
    </div>
  );
}
