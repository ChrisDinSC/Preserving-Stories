import { cookies } from "next/headers";

/**
 * Name of the cookie that remembers which archive the user is currently viewing.
 * httpOnly so it cannot be tampered with from client JS; the value is always
 * re-validated against the user's memberships on the server before use.
 */
export const ACTIVE_ARCHIVE_COOKIE = "em_active_archive";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Read the active-archive id from the cookie (may be null / stale). */
export function readActiveArchiveCookie(): string | null {
  return cookies().get(ACTIVE_ARCHIVE_COOKIE)?.value ?? null;
}

/** Persist the active-archive id in a secure, http-only cookie. */
export function writeActiveArchiveCookie(archiveId: string): void {
  cookies().set(ACTIVE_ARCHIVE_COOKIE, archiveId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

/** Clear the active-archive cookie (e.g. on sign out). */
export function clearActiveArchiveCookie(): void {
  cookies().delete(ACTIVE_ARCHIVE_COOKIE);
}
