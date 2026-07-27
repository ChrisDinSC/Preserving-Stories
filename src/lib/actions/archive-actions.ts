"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  writeActiveArchiveCookie,
} from "@/lib/active-archive";
import { getAppUrl } from "@/lib/utils";
import {
  archiveSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "@/lib/validations/archive";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Optional payload (e.g. an invitation link or new archive id). */
  data?: Record<string, unknown>;
}

/** Map a raw Postgres/RPC error message to a friendly, user-facing string. */
function friendlyError(raw: string | undefined): string {
  const message = (raw ?? "").toLowerCase();
  const map: Record<string, string> = {
    not_authenticated: "You need to be signed in to do that.",
    not_authorized: "You don't have permission to do that.",
    invalid_name: "Please enter an archive name.",
    invalid_email: "Please enter a valid email address.",
    invalid_role: "That role can't be assigned.",
    already_member: "That person is already a member of this archive.",
    already_invited: "There's already a pending invitation for that email.",
    cannot_modify_owner: "The archive owner's role can't be changed.",
    cannot_remove_owner: "The archive owner can't be removed.",
    cannot_demote_owner: "The archive owner can't be demoted.",
    cannot_modify_self: "You can't change your own role.",
    cannot_remove_self: "You can't remove yourself from the archive.",
    not_found: "That item could not be found.",
    invitation_invalid: "This invitation link is not valid.",
    invitation_expired: "This invitation has expired.",
    invitation_revoked: "This invitation has been revoked.",
    invitation_already_accepted: "This invitation has already been accepted.",
    invitation_wrong_email:
      "This invitation was sent to a different email address.",
  };
  for (const key of Object.keys(map)) {
    if (message.includes(key)) return map[key];
  }
  return "Something went wrong. Please try again.";
}

/** SHA-256 hash (hex) of an invitation token. Only the hash is ever stored. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Create archive (onboarding) — atomic via RPC, then set it active.
// ---------------------------------------------------------------------------
export async function createArchiveAction(input: {
  name: string;
  description?: string;
}): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  const { data, error } = await supabase.rpc("create_archive_with_owner", {
    p_name: parsed.data.name,
    p_description: parsed.data.description ? parsed.data.description : null,
  });

  if (error || !data) {
    return { ok: false, error: friendlyError(error?.message) };
  }

  writeActiveArchiveCookie(data as string);
  revalidatePath("/dashboard");
  revalidatePath("/archive");
  return { ok: true, data: { archiveId: data as string } };
}

// ---------------------------------------------------------------------------
// Edit archive name / description (owner only; RLS re-checks ownership).
// ---------------------------------------------------------------------------
export async function updateArchiveAction(input: {
  archiveId: string;
  name: string;
  description?: string;
}): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (!input.archiveId) return { ok: false, error: friendlyError("not_found") };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  const { error } = await supabase
    .from("archives")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ? parsed.data.description : null,
    })
    .eq("id", input.archiveId);

  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/archive");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invite a member (owner only). Token generated server-side; never logged.
// Returns a shareable invitation link (email delivery is out of scope).
// ---------------------------------------------------------------------------
export async function inviteMemberAction(input: {
  archiveId: string;
  email: string;
  role: string;
}): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse({
    email: input.email,
    role: input.role,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (!input.archiveId) return { ok: false, error: friendlyError("not_found") };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  // High-entropy token: the plaintext appears only in the link below; the DB
  // stores only its SHA-256 hash so a leaked table cannot be used to accept.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.rpc("create_invitation", {
    p_archive_id: input.archiveId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: hashToken(token),
    p_expires_at: expiresAt,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };

  const link = `${getAppUrl()}/invitations/${token}`;
  revalidatePath("/archive");
  return { ok: true, data: { link, email: parsed.data.email } };
}

// ---------------------------------------------------------------------------
// Revoke a pending invitation (owner only).
// ---------------------------------------------------------------------------
export async function revokeInvitationAction(input: {
  invitationId: string;
}): Promise<ActionResult> {
  if (!input.invitationId) return { ok: false, error: friendlyError("not_found") };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: input.invitationId,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/archive");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Change a member's role (owner only; owner row / self are protected by RPC).
// ---------------------------------------------------------------------------
export async function updateMemberRoleAction(input: {
  memberId: string;
  role: string;
}): Promise<ActionResult> {
  const parsed = updateMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  const { error } = await supabase.rpc("update_member_role", {
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/archive");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Remove a member (owner only; owner row / self are protected by RPC).
// ---------------------------------------------------------------------------
export async function removeMemberAction(input: {
  memberId: string;
}): Promise<ActionResult> {
  if (!input.memberId) return { ok: false, error: friendlyError("not_found") };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  const { error } = await supabase.rpc("remove_member", {
    p_member_id: input.memberId,
  });

  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/archive");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Accept an invitation (only the invited email may accept; RPC re-validates).
// ---------------------------------------------------------------------------
export async function acceptInvitationAction(input: {
  token: string;
}): Promise<ActionResult> {
  if (!input.token) return { ok: false, error: friendlyError("invitation_invalid") };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token_hash: hashToken(input.token),
  });

  if (error || !data) return { ok: false, error: friendlyError(error?.message) };

  writeActiveArchiveCookie(data as string);
  revalidatePath("/dashboard");
  revalidatePath("/archive");
  return { ok: true, data: { archiveId: data as string } };
}

// ---------------------------------------------------------------------------
// Switch the active archive (validated against the user's memberships).
// ---------------------------------------------------------------------------
export async function setActiveArchiveAction(input: {
  archiveId: string;
}): Promise<ActionResult> {
  if (!input.archiveId) return { ok: false, error: friendlyError("not_found") };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };

  // Re-validate membership before trusting the requested archive id.
  const { data: membership } = await supabase
    .from("archive_members")
    .select("id")
    .eq("archive_id", input.archiveId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { ok: false, error: friendlyError("not_authorized") };

  writeActiveArchiveCookie(input.archiveId);
  revalidatePath("/dashboard");
  revalidatePath("/archive");
  revalidatePath("/library");
  return { ok: true };
}
