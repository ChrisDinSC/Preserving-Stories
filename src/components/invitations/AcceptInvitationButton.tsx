"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { acceptInvitationAction } from "@/lib/actions/archive-actions";

interface AcceptInvitationButtonProps {
  token: string;
}

export function AcceptInvitationButton({ token }: AcceptInvitationButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onAccept() {
    setError(null);
    setBusy(true);
    const result = await acceptInvitationAction({ token });
    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? "We couldn't accept this invitation.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      <Button
        type="button"
        className="w-full"
        size="lg"
        isLoading={busy}
        onClick={onAccept}
      >
        Accept invitation
      </Button>
    </div>
  );
}
