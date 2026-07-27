"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Trash2, Copy, Check, Mail } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validations/archive";
import {
  inviteMemberAction,
  revokeInvitationAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/lib/actions/archive-actions";
import type { ArchiveMemberWithProfile, ArchiveInvitation } from "@/types";

interface MembersManagerProps {
  archiveId: string;
  currentUserId: string;
  isOwner: boolean;
  members: ArchiveMemberWithProfile[];
  pendingInvitations: ArchiveInvitation[];
}

function roleBadgeVariant(role: string): "forest" | "warm" | "neutral" {
  if (role === "owner") return "forest";
  if (role === "contributor") return "warm";
  return "neutral";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MembersManager({
  archiveId,
  currentUserId,
  isOwner,
  members,
  pendingInvitations,
}: MembersManagerProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  async function onInvite(values: InviteMemberInput) {
    setInviteLink(null);
    setInvitedEmail(null);
    setCopied(false);
    const result = await inviteMemberAction({
      archiveId,
      email: values.email,
      role: values.role,
    });
    if (!result.ok) {
      setError("email", { message: result.error ?? "Could not send invitation." });
      return;
    }
    setInviteLink((result.data?.link as string) ?? null);
    setInvitedEmail((result.data?.email as string) ?? values.email);
    reset({ email: "", role: "viewer" });
    router.refresh();
  }

  async function onRoleChange(memberId: string, role: string) {
    setRowError(null);
    setBusyId(memberId);
    const result = await updateMemberRoleAction({ memberId, role });
    setBusyId(null);
    if (!result.ok) {
      setRowError(result.error ?? "Could not update role.");
      return;
    }
    router.refresh();
  }

  async function onRemove(memberId: string, name: string) {
    if (
      !window.confirm(
        `Remove ${name} from this archive? They will lose access to its stories.`,
      )
    ) {
      return;
    }
    setRowError(null);
    setBusyId(memberId);
    const result = await removeMemberAction({ memberId });
    setBusyId(null);
    if (!result.ok) {
      setRowError(result.error ?? "Could not remove member.");
      return;
    }
    router.refresh();
  }

  async function onRevoke(invitationId: string) {
    setRowError(null);
    setBusyId(invitationId);
    const result = await revokeInvitationAction({ invitationId });
    setBusyId(null);
    if (!result.ok) {
      setRowError(result.error ?? "Could not revoke invitation.");
      return;
    }
    router.refresh();
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — the link is still visible for manual copy.
    }
  }

  return (
    <div className="space-y-8">
      {rowError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {rowError}
        </div>
      ) : null}

      {/* Member list */}
      <div>
        <h3 className="font-heading text-lg text-stone-900">
          Members ({members.length})
        </h3>
        <ul className="mt-4 divide-y divide-stone-100">
          {members.map((member) => {
            const name = member.full_name ?? member.email ?? "Member";
            const isSelf = member.user_id === currentUserId;
            const isOwnerRow = member.role === "owner";
            const canManage = isOwner && !isOwnerRow && !isSelf;
            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={name} src={member.avatar_url ?? undefined} />
                  <div>
                    <p className="text-base font-medium text-stone-900">
                      {name}
                      {isSelf ? (
                        <span className="ml-2 text-sm font-normal text-stone-500">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-stone-500">{member.email}</p>
                    <p className="text-xs text-stone-400">
                      Joined {formatDate(member.joined_at ?? member.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {canManage ? (
                    <>
                      <Label
                        htmlFor={`role-${member.id}`}
                        className="sr-only"
                      >
                        Role for {name}
                      </Label>
                      <select
                        id={`role-${member.id}`}
                        defaultValue={member.role}
                        disabled={busyId === member.id}
                        onChange={(e) => onRoleChange(member.id, e.target.value)}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-200"
                      >
                        <option value="contributor">Contributor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${name}`}
                        isLoading={busyId === member.id}
                        onClick={() => onRemove(member.id, name)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
                      </Button>
                    </>
                  ) : (
                    <Badge variant={roleBadgeVariant(member.role)}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Owner-only: invite + pending invitations */}
      {isOwner ? (
        <>
          <div className="rounded-2xl border border-stone-200 bg-warm-50/60 p-5">
            <h3 className="flex items-center gap-2 font-heading text-lg text-stone-900">
              <UserPlus className="h-5 w-5 text-warm-600" aria-hidden />
              Invite a family member
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              We&apos;ll create a private invitation link you can share with them.
            </p>

            <form
              onSubmit={handleSubmit(onInvite)}
              className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="name@example.com"
                  required
                  error={errors.email?.message}
                  {...register("email")}
                />
              </div>
              <div className="sm:w-44">
                <Label htmlFor="invite-role" required>
                  Role
                </Label>
                <select
                  id="invite-role"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-200"
                  {...register("role")}
                >
                  <option value="viewer">Viewer</option>
                  <option value="contributor">Contributor</option>
                </select>
              </div>
              <Button type="submit" isLoading={isSubmitting}>
                Send invite
              </Button>
            </form>

            {inviteLink ? (
              <div className="mt-4 rounded-xl border border-forest-200 bg-forest-50 p-4">
                <p className="text-sm font-medium text-forest-800">
                  Invitation created for {invitedEmail}. Share this private link:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-stone-700">
                    {inviteLink}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={copyLink}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1 h-4 w-4" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-4 w-4" aria-hidden /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-forest-700">
                  Only {invitedEmail} can accept it, and it expires in 14 days.
                </p>
              </div>
            ) : null}
          </div>

          {pendingInvitations.length > 0 ? (
            <div>
              <h3 className="flex items-center gap-2 font-heading text-lg text-stone-900">
                <Mail className="h-5 w-5 text-stone-500" aria-hidden />
                Pending invitations ({pendingInvitations.length})
              </h3>
              <ul className="mt-4 divide-y divide-stone-100">
                {pendingInvitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-stone-900">
                        {inv.email}
                      </p>
                      <p className="text-sm text-stone-500">
                        {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)} ·
                        Invited {formatDate(inv.created_at)}
                        {inv.expires_at
                          ? ` · Expires ${formatDate(inv.expires_at)}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isLoading={busyId === inv.id}
                      onClick={() => onRevoke(inv.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
