# EverMoments

> Repository: **Preserving-Stories** — the family audio archive application.

EverMoments lets families **record, preserve, organize, search, and privately share**
personal stories in the storyteller's own voice.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (warm, family-centered design system)
- **Supabase** — PostgreSQL, Auth, and Storage
- **React Hook Form** + **Zod** for forms and validation
- **lucide-react** for icons

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)
- A Supabase account (the free tier works fine)

## Local Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/ChrisDinSC/Preserving-Stories.git
   cd Preserving-Stories
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example file and fill in your Supabase credentials:

   ```bash
   cp .env.local.example .env.local
   ```

   See [Environment Variables](#environment-variables) below.

4. **Set up Supabase**

   a. Create a new project in the [Supabase dashboard](https://supabase.com/dashboard).

   b. Open the **SQL Editor** and run the contents of
      [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql).
      This creates all tables, indexes, triggers, Row Level Security policies, and the
      `audio-recordings` storage bucket.

   c. Verify the migration succeeded: under **Storage**, confirm a bucket named
      `audio-recordings` exists and is set to **private** (created automatically by the
      migration).

   d. Under **Project Settings → API**, copy the **Project URL** and **anon public key**
      into `.env.local`.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
   `/login`. Create an account, then confirm your email (Supabase sends a
   confirmation link) and sign in.

## Environment Variables

Defined in `.env.local` (see `.env.local.example`):

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app (e.g. `http://localhost:3000`) |

> `.env.local` is git-ignored. Never commit real secrets.

## Available Scripts

- `npm run dev` — start the development server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint

## Project Structure

```
src/
  app/
    (auth)/            # Public auth screens (login, signup, forgot-password)
    (app)/             # Protected app shell (dashboard, library, record, archive, account)
    layout.tsx         # Root layout — fonts (Inter + Lora) and metadata
    page.tsx           # Landing route — redirects based on auth state
    globals.css        # Tailwind layers + base typography
  components/
    ui/                # Primitives: Button, Input, Label, Card, Badge, Avatar, Spinner
    layout/            # Sidebar, MobileNav, TopBar
    auth/              # LoginForm, SignupForm, ForgotPasswordForm
  lib/
    supabase/          # Browser client, server client, middleware session helper
    validations/       # Zod schemas (auth, story)
    utils.ts           # Small shared helpers
  types/               # Typed DB schema + shared app types
  middleware.ts        # Route protection + session refresh
supabase/
  migrations/          # SQL migrations (001_initial_schema.sql)
  seed.sql             # Optional seed stubs
```

### Routing & Auth

- Unauthenticated visits to protected routes (`/dashboard`, `/library`, `/record`,
  `/archive`, `/account`) are redirected to `/login` by `src/middleware.ts`.
- Authenticated users visiting `/login`, `/signup`, or `/forgot-password` are redirected
  to `/dashboard`.
- Sessions are refreshed on every request in the middleware.

## Database

The complete schema lives in
[`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql):
tables (`profiles`, `archives`, `archive_members`, `archive_invitations`, `stories`,
`story_people`, `tags`, `story_tags`, `story_permissions`), foreign-key indexes,
`updated_at` triggers, an `auth.users` → `profiles` signup trigger, and Row Level
Security policies on every table. Run it in the Supabase SQL editor for a new project.

## Phase 2 — Archives, Members & Invitations

Phase 2 turns the Phase 1 shell into a working, Supabase-connected family-archive
system. Everything below is enforced in the database (RLS + `SECURITY DEFINER`
functions) so it holds even though the app connects with **only the anon key**.

### What's included

- **Onboarding** — first-time users create their first archive (`/onboarding`),
  which also makes them its owner in one atomic step.
- **Archive detail & management** (`/archive`) — name, description, owner, member
  count, your role, and (for owners) inline editing.
- **Member management** — owners can add, remove, and change the role of members;
  the single owner can never be demoted or removed.
- **Invitation flow** — owners invite people by email as *contributor* or *viewer*,
  and get a **shareable invite link**. Recipients open `/invitations/[token]`,
  which validates the invite and lets the matching signed-in user accept it.
- **Live dashboard** (`/dashboard`) — real story counts and member count for the
  active archive.
- **Archive switcher** — users who belong to more than one archive can switch the
  active archive from the dashboard.

### Applying the schema

Phase 2 does **not** add a second migration. All Phase 2 changes are folded
directly into
[`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
(it had not been deployed, so there was no history to preserve). Apply that single
file in the Supabase SQL editor for a fresh project — it is safe to run and
re-runnable (policies/triggers are dropped before being recreated).

### Authorization model

The full authorization matrix, attack→defense table, and an executable local proof
are documented in [`scripts/AUTHORIZATION.md`](scripts/AUTHORIZATION.md). In short:

- Exactly **one owner** per archive (partial unique index); owners can't be
  demoted/removed and can't be minted via a role change (enforced by trigger).
- Invitations, member management, and archive edits are **owner-only**.
- Invitation **tokens are hashed** — the DB stores only the SHA-256 hash; the
  plaintext token appears only in the shareable link and is never persisted.
- Acceptance is a `SECURITY DEFINER` function that verifies the token hash + email
  match, rejects expired/revoked/invalid/already-accepted invites and existing
  members, and inserts the membership atomically.
- Story visibility is gated by `can_view_story()`; moving a story to another
  archive requires contributor access to the destination; selected story viewers
  must be members of the story's archive.
- The `audio-recordings` bucket is **private** with an audio-only MIME allow-list
  and a 50 MB limit; every object op is scoped to the user's own `uid/` prefix.
- Every `SECURITY DEFINER` function pins `search_path = public`, and `EXECUTE` is
  revoked from `PUBLIC` and granted only to `authenticated`.

### Verifying authorization locally

`scripts/authz-checks.sql` runs 17 assertions covering the matrix above in a single
transaction that rolls back at the end (non-destructive). Against any Postgres 17
instance (`$URI` = connection string):

```bash
psql "$URI" -v ON_ERROR_STOP=1 -f scripts/_local_stubs.sql
psql "$URI" -v ON_ERROR_STOP=1 -f supabase/migrations/001_initial_schema.sql
psql "$URI" -v ON_ERROR_STOP=1 -f scripts/authz-checks.sql
# → NOTICE:  ALL AUTHORIZATION CHECKS PASSED
```

`scripts/_local_stubs.sql` provides minimal local stand-ins for the Supabase-managed
`auth`/`storage` objects so the checks can run on vanilla Postgres. On a local
Postgres without the `pgcrypto`/`moddatetime` extensions, strip the two
`create extension` lines first (both are available on Supabase).

### Manual test (two accounts)

1. Sign up as **Account A**; complete onboarding to create an archive.
2. On `/archive`, invite **Account B**'s email as viewer/contributor and copy the
   invite link.
3. Open the link while signed in as **Account B** (matching email) → accept →
   you're taken to the dashboard and see the archive.
4. Confirm B (viewer) can't edit the archive or manage members; A can change B's
   role and remove B; neither can demote/remove the owner.

### Email delivery is out of scope

This phase surfaces a **shareable invite link** instead of sending email. Wiring an
email provider (e.g. Resend, Postmark, or Supabase's built-in email) to deliver the
link automatically is future work — the link itself is fully functional today.

### Security note

The app uses **only** the Supabase URL and anon key — never the service-role key.
No secrets are hardcoded; all credentials come from `.env.local`.

## Design

Warm, trustworthy, and calm — built for all ages. Custom Tailwind palette (warm ambers,
deep forest greens, stone neutrals), **Lora** for headings and **Inter** for body text,
large tap targets, and generous spacing.
