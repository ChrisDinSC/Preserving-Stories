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

## Design

Warm, trustworthy, and calm — built for all ages. Custom Tailwind palette (warm ambers,
deep forest greens, stone neutrals), **Lora** for headings and **Inter** for body text,
large tap targets, and generous spacing.
