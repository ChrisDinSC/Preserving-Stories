// These helpers use next/headers (cookies) via the server Supabase client and
// are therefore server-only by construction.
import { createClient } from "@/lib/supabase/server";
import { readActiveArchiveCookie } from "@/lib/active-archive";
import type {
  Archive,
  ArchiveRole,
  ArchiveMemberWithProfile,
  ArchiveInvitation,
  Profile,
} from "@/types";

export interface ArchiveMembership {
  archive: Archive;
  role: ArchiveRole;
}

export interface ArchiveDetail {
  archive: Archive;
  owner: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  role: ArchiveRole;
  memberCount: number;
}

/**
 * Every archive the current user belongs to, paired with their role, most
 * recently joined first. Returns [] when the user has no memberships.
 */
export async function getUserArchives(): Promise<ArchiveMembership[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("archive_members")
    .select("role, created_at, archives (*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data
    .filter((row) => row.archives)
    .map((row) => ({
      archive: row.archives as unknown as Archive,
      role: row.role as ArchiveRole,
    }));
}

/**
 * The user's currently active archive (from the cookie, validated against
 * their memberships) or the first archive they belong to. null if none.
 */
export async function getActiveArchive(): Promise<ArchiveMembership | null> {
  const memberships = await getUserArchives();
  if (memberships.length === 0) return null;

  const cookieId = readActiveArchiveCookie();
  if (cookieId) {
    const match = memberships.find((m) => m.archive.id === cookieId);
    if (match) return match;
  }
  return memberships[0];
}

/** Full detail for a single archive the user can access. */
export async function getArchiveDetail(
  archiveId: string,
): Promise<ArchiveDetail | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: archive, error: archiveError } = await supabase
    .from("archives")
    .select("*")
    .eq("id", archiveId)
    .single();
  if (archiveError || !archive) return null;

  // The caller's role in this archive.
  const { data: membership } = await supabase
    .from("archive_members")
    .select("role")
    .eq("archive_id", archiveId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null; // not a member -> no access

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", archive.owner_id)
    .maybeSingle();

  const { count } = await supabase
    .from("archive_members")
    .select("id", { count: "exact", head: true })
    .eq("archive_id", archiveId);

  return {
    archive: archive as Archive,
    owner: owner ?? null,
    role: membership.role as ArchiveRole,
    memberCount: count ?? 0,
  };
}

/** Member list (with profile + email) via the SECURITY DEFINER RPC. */
export async function getArchiveMembers(
  archiveId: string,
): Promise<ArchiveMemberWithProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_archive_members", {
    p_archive_id: archiveId,
  });
  if (error || !data) return [];
  return data as ArchiveMemberWithProfile[];
}

/** Pending (not accepted, not revoked, not expired) invitations for an archive. */
export async function getPendingInvitations(
  archiveId: string,
): Promise<ArchiveInvitation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("archive_invitations")
    .select("*")
    .eq("archive_id", archiveId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  // Hide already-expired invitations from the pending list.
  const now = Date.now();
  return (data as ArchiveInvitation[]).filter(
    (inv) => !inv.expires_at || new Date(inv.expires_at).getTime() > now,
  );
}

/** Count stories in an archive (0 until Phase 3 adds story creation). */
export async function getStoryCounts(
  archiveId: string,
  userId: string,
): Promise<{ total: number; drafts: number }> {
  const supabase = createClient();

  const { count: total } = await supabase
    .from("stories")
    .select("id", { count: "exact", head: true })
    .eq("archive_id", archiveId);

  const { count: drafts } = await supabase
    .from("stories")
    .select("id", { count: "exact", head: true })
    .eq("archive_id", archiveId)
    .eq("owner_id", userId)
    .eq("status", "draft");

  return { total: total ?? 0, drafts: drafts ?? 0 };
}
