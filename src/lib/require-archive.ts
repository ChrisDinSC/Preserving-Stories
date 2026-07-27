import { redirect } from "next/navigation";

import { getActiveArchive, type ArchiveMembership } from "@/lib/archives";

/**
 * Guard for protected pages that require an archive. If the user has no archive
 * membership they are redirected into the onboarding flow. Otherwise the active
 * archive (validated cookie or first membership) is returned.
 *
 * Do NOT call this from the onboarding page itself (it would loop).
 */
export async function requireActiveArchive(): Promise<ArchiveMembership> {
  const active = await getActiveArchive();
  if (!active) {
    redirect("/onboarding");
  }
  return active;
}
