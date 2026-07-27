# EverMoments — Authorization Model

This document describes how access control is enforced in the EverMoments
database (`supabase/migrations/001_initial_schema.sql`) and how to prove it
holds. The application connects to Supabase with **only the anon key** — it
never uses the service-role key — so every authorization boundary below is
enforced in the database itself (Row-Level Security + `SECURITY DEFINER`
functions), not in application code that a client could bypass.

## Roles

Every archive has exactly **one owner** and any number of contributors and
viewers. Membership lives in `public.archive_members (archive_id, user_id, role)`.

| Role          | Meaning                                                        |
|---------------|----------------------------------------------------------------|
| `owner`       | Full control of the archive, members, invitations, and stories |
| `contributor` | Can add stories and content to the archive                     |
| `viewer`      | Read-only access to the archive and its stories                |

## Authorization matrix

| Resource / action                     | owner | contributor | viewer | invited (pre-join) |
|---------------------------------------|:-----:|:-----------:|:------:|:------------------:|
| archive: view                         |  ✅   |     ✅      |   ✅   |         ❌         |
| archive: edit / delete                |  ✅   |     ❌      |   ❌   |         ❌         |
| member list: view                     |  ✅   |     ✅      |   ✅   |         ❌         |
| member: add / remove / change role    |  ✅   |     ❌      |   ❌   |         ❌         |
| owner demote / remove                 |  🚫 NEVER (blocked by trigger + RPC guards)          |
| invitation: create / view / revoke    |  ✅   |     ❌      |   ❌   |         ❌         |
| invitation: accept                    |  only the authenticated user whose email matches    |
| story: view                           |  owner / archive members / explicitly selected viewers |
| story: create                         |  owner + contributor (`owner_id` = self)             |
| story: edit / delete                  |  story owner only                                    |
| story: move to another archive        |  requires contributor access to the destination      |
| selected story viewers                |  must be members of the story's archive              |
| storage (audio bucket)                |  private; upload only under own `uid/` path; read/update/delete only by object owner |

## Where each rule is enforced

- **One owner per archive** — partial unique index
  `archive_members_one_owner_per_archive` (`where role = 'owner'`).
- **Owner cannot be demoted / removed; owner cannot be minted via update** —
  trigger `protect_archive_owner` raises `cannot_demote_owner`,
  `cannot_assign_owner`, `cannot_remove_owner`.
- **Atomic archive creation** — `create_archive_with_owner(name, description)`
  inserts the archive and the owner membership in one transaction, so no
  orphan archives can exist.
- **Members can only be managed by owners** — RLS policies on
  `archive_members` plus the `update_member_role` / `remove_member` RPCs (which
  re-check ownership and re-apply the owner guards).
- **Invitations are owner-only** — RLS on `archive_invitations` restricts
  insert/select/update/delete to the archive owner. `create_invitation`
  rejects the `owner` role (`cannot_invite_owner`), normalizes the email to
  `lower(trim())`, requires `expires_at`, and the partial unique index
  `archive_invitations_unique_pending` prevents duplicate pending invites for
  the same (archive, email).
- **Invitation tokens are hashed** — the app generates a high-entropy random
  token, stores **only its SHA-256 hash** (`token_hash`), and puts the
  plaintext token only in the shareable link. Lookups (`get_invitation_by_token`)
  and acceptance (`accept_invitation`) take the hash, never the plaintext.
- **Invitation acceptance is safe** — `accept_invitation(p_token_hash)` is
  `SECURITY DEFINER`, requires an authenticated user, verifies the token hash
  and that the caller's email matches the invite, rejects
  expired/revoked/invalid/already-accepted invitations and callers who are
  already members, then inserts the membership and marks the invite accepted
  atomically (row locked `for update`).
- **Profiles** — a member can read the limited profile fields of co-members in
  archives they share (`shares_archive_with`), and nothing about unrelated
  users. Profile updates are self-only.
- **Stories** — `can_view_story()` gates reads (owner / archive member /
  explicitly-selected viewer). Editing is restricted to the story owner;
  trigger `stories_guard_archive_change` requires contributor access to the
  destination archive when `archive_id` changes; `story_permissions` write
  checks require the selected user to be a member of the story's archive.
- **Storage** — the `audio-recordings` bucket is **private** with a 50 MB size
  limit and an audio-only MIME allow-list. Upload/read/update/delete policies
  require `(storage.foldername(name))[1] = auth.uid()::text`, so a user can only
  touch objects under their own `uid/` prefix.
- **SECURITY DEFINER hardening** — every `SECURITY DEFINER` function sets a
  fixed `search_path = public`, and `EXECUTE` is revoked from `PUBLIC` and
  granted only to `authenticated`.

## Attack → defense

| Attempted attack                                             | Defense                                                      |
|--------------------------------------------------------------|--------------------------------------------------------------|
| Non-owner tries to invite / manage members                  | RLS + RPC ownership check → `not_authorized`                 |
| Invite someone as `owner` to seize control                  | `create_invitation` rejects `owner` → `cannot_invite_owner`  |
| Create a second owner directly                              | one-owner partial unique index → `unique_violation`          |
| Demote / delete the owner                                   | `protect_archive_owner` trigger → `cannot_*_owner`           |
| Reuse / brute a token from the DB                            | only the SHA-256 hash is stored; plaintext never persisted   |
| Accept an invite meant for another email                    | `accept_invitation` verifies email match → `invitation_wrong_email` |
| Replay an accepted / expired / revoked invite               | status checks → `invitation_*` errors                        |
| Accept when already a member                                | membership check → `already_member`                          |
| Read strangers' profiles                                    | profiles RLS via `shares_archive_with`                       |
| Move a story into an archive you can't write                | `stories_guard_archive_change` → `not_authorized`            |
| Share a story with a non-member                             | `story_permissions` write-check requires archive membership  |
| Download another user's audio                               | storage policies scope every op to `uid/` prefix             |

## Proving it locally

The repo ships an executable proof. `scripts/authz-checks.sql` runs 17
assertions in a single transaction (which rolls back at the end, so it is
non-destructive) covering every row of the matrix above. Because a plain
Postgres server has no Supabase `auth`/`storage` schemas, `scripts/_local_stubs.sql`
provides minimal local stand-ins (the `authenticated` role, `auth.uid()`,
`auth.users`, `storage.foldername`, and the grants Supabase normally provisions).

```bash
# Against any Postgres 17 instance ($URI = connection string)
psql "$URI" -v ON_ERROR_STOP=1 -f scripts/_local_stubs.sql
psql "$URI" -v ON_ERROR_STOP=1 -f supabase/migrations/001_initial_schema.sql
psql "$URI" -v ON_ERROR_STOP=1 -f scripts/authz-checks.sql
```

A clean run ends with:

```
NOTICE:  ALL AUTHORIZATION CHECKS PASSED
```

> Note: on a bundled/local Postgres without the `pgcrypto` / `moddatetime`
> extensions, strip the two `create extension` lines before applying the
> migration (`gen_random_uuid()` is built in to Postgres 17; `set_updated_at`
> is a plain trigger function and does not need `moddatetime`). On Supabase both
> extensions are available and the migration runs as-is.

### What the local proof does and does not cover

The local checks exercise the **database** authorization logic exactly as
Supabase evaluates it (RLS under the `authenticated` role, `auth.uid()` from the
JWT `sub` claim, and all the `SECURITY DEFINER` RPCs). They were run and **all
17 checks passed**.

They do **not** exercise a live Supabase project, real auth sign-up, real email
delivery, or the browser UI — those require the hosted environment and are
covered by the manual walkthrough below. The migration has **not** been applied
to Supabase automatically; apply it yourself after reviewing it.

## Manual two-account walkthrough (on Supabase)

1. Apply `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor
   (fresh project).
2. Sign up as **Account A**, complete onboarding to create an archive.
3. In the archive page, invite **Account B**'s email as a *viewer* or
   *contributor*. Copy the shareable invite link (email delivery is out of
   scope for this phase — see the README).
4. Open the invite link while signed in as **Account B** with the matching
   email → accept. Confirm B lands on the dashboard and sees the archive.
5. Verify: B (viewer) cannot edit the archive or manage members; A can change
   B's role and remove B; neither can demote/remove the owner; the archive
   switcher appears for B once they belong to more than one archive.
6. Try the invite link with a *different* account/email → it is rejected with a
   "wrong email" message; a revoked or already-accepted link shows the matching
   friendly message.
