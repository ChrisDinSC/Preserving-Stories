import { createHash } from "crypto";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, Mail, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AcceptInvitationButton } from "@/components/invitations/AcceptInvitationButton";
import type { InvitationLookup } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation — EverMoments" };

function roleLabel(role: string | null): string {
  if (!role) return "member";
  if (role === "contributor") return "contributor (can add stories)";
  if (role === "viewer") return "viewer (can read stories)";
  return role;
}

interface PageProps {
  params: { token: string };
}

export default async function InvitationPage({ params }: PageProps) {
  const token = params.token;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_invitation_by_token", {
    p_token_hash: tokenHash,
  });

  const invitation = (data as InvitationLookup[] | null)?.[0] ?? null;
  const status = invitation?.status ?? (error ? "invalid" : "invalid");

  // --- Valid invitation the signed-in user may accept ---
  if (status === "valid" && invitation) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-100">
            <Mail className="h-7 w-7 text-forest-600" aria-hidden />
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl text-stone-900">
            Join “{invitation.archive_name}”
          </h1>
          <p className="text-stone-600">
            {invitation.inviter_name
              ? `${invitation.inviter_name} invited you`
              : "You've been invited"}{" "}
            to join this family archive as a{" "}
            <Badge variant="warm">{roleLabel(invitation.role)}</Badge>.
          </p>
        </div>
        <AcceptInvitationButton token={token} />
        <p className="text-xs text-stone-400">
          Signed in as {invitation.email}. This invitation is private to you.
        </p>
      </div>
    );
  }

  // --- Everything else: a clear, friendly explanation ---
  const states: Record<
    string,
    { Icon: typeof XCircle; title: string; message: string; tint: string }
  > = {
    accepted: {
      Icon: CheckCircle2,
      title: "Already accepted",
      message:
        "This invitation has already been used. You should already have access to the archive.",
      tint: "text-forest-600 bg-forest-100",
    },
    revoked: {
      Icon: XCircle,
      title: "Invitation revoked",
      message:
        "The archive owner has revoked this invitation. Please ask them to send a new one if you still need access.",
      tint: "text-red-600 bg-red-100",
    },
    expired: {
      Icon: Clock,
      title: "Invitation expired",
      message:
        "This invitation is no longer valid. Please ask the archive owner to send you a fresh invitation.",
      tint: "text-stone-500 bg-stone-100",
    },
    wrong_email: {
      Icon: ShieldAlert,
      title: "Different email address",
      message:
        "This invitation was sent to a different email address than the one you're signed in with. Sign in with the invited email to accept it.",
      tint: "text-warm-600 bg-warm-100",
    },
    invalid: {
      Icon: XCircle,
      title: "Invitation not found",
      message:
        "This invitation link isn't valid. Please double-check the link or ask the archive owner to send a new one.",
      tint: "text-red-600 bg-red-100",
    },
  };

  const view = states[status] ?? states.invalid;
  const Icon = view.Icon;

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full ${view.tint}`}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </span>
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl text-stone-900">{view.title}</h1>
        <p className="text-stone-600">{view.message}</p>
      </div>
      <Link href="/dashboard" className="block">
        <Button variant="secondary" className="w-full">
          Go to dashboard
        </Button>
      </Link>
    </div>
  );
}
