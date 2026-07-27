-- ============================================================================
-- EverMoments — Initial schema (Phase 1)
-- Family audio archive: profiles, archives, membership, stories, tags, sharing.
-- Run this in the Supabase SQL editor for a fresh project.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "moddatetime" schema extensions; -- updated_at trigger

-- ============================================================================
-- Helper: updated_at trigger function
-- (moddatetime is used where available; this manual function is a portable
--  fallback and is what the triggers below reference.)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Table: profiles (1:1 with auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Table: archives
-- ============================================================================
create table if not exists public.archives (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists archives_owner_id_idx on public.archives (owner_id);

create trigger archives_set_updated_at
  before update on public.archives
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Table: archive_members
-- ============================================================================
create table if not exists public.archive_members (
  id          uuid primary key default gen_random_uuid(),
  archive_id  uuid not null references public.archives (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('owner', 'contributor', 'viewer')),
  invited_by  uuid references public.profiles (id) on delete set null,
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (archive_id, user_id)
);

create index if not exists archive_members_archive_id_idx on public.archive_members (archive_id);
create index if not exists archive_members_user_id_idx on public.archive_members (user_id);
create index if not exists archive_members_role_idx on public.archive_members (role);

-- ============================================================================
-- Table: archive_invitations
-- ============================================================================
create table if not exists public.archive_invitations (
  id          uuid primary key default gen_random_uuid(),
  archive_id  uuid not null references public.archives (id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('owner', 'contributor', 'viewer')),
  token       text not null unique,
  invited_by  uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists archive_invitations_archive_id_idx on public.archive_invitations (archive_id);
create index if not exists archive_invitations_email_idx on public.archive_invitations (email);

-- ============================================================================
-- Table: stories
-- ============================================================================
create table if not exists public.stories (
  id               uuid primary key default gen_random_uuid(),
  archive_id       uuid not null references public.archives (id) on delete cascade,
  title            text not null,
  storyteller      text,
  description      text,
  audio_url        text,
  transcript       text,
  date_label       text,
  date_approximate date,
  status           text not null default 'draft' check (status in ('draft', 'published')),
  privacy          text not null default 'private'
                     check (privacy in ('private', 'archive_members', 'selected_members')),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists stories_archive_id_idx on public.stories (archive_id);
create index if not exists stories_owner_id_idx on public.stories (owner_id);
create index if not exists stories_status_idx on public.stories (status);
create index if not exists stories_privacy_idx on public.stories (privacy);

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Table: story_people
-- ============================================================================
create table if not exists public.story_people (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists story_people_story_id_idx on public.story_people (story_id);

-- ============================================================================
-- Table: tags
-- ============================================================================
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.archives (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (archive_id, name)
);

create index if not exists tags_archive_id_idx on public.tags (archive_id);

-- ============================================================================
-- Table: story_tags (join)
-- ============================================================================
create table if not exists public.story_tags (
  story_id uuid not null references public.stories (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  primary key (story_id, tag_id)
);

create index if not exists story_tags_tag_id_idx on public.story_tags (tag_id);

-- ============================================================================
-- Table: story_permissions (for privacy = 'selected_members')
-- ============================================================================
create table if not exists public.story_permissions (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);

create index if not exists story_permissions_story_id_idx on public.story_permissions (story_id);
create index if not exists story_permissions_user_id_idx on public.story_permissions (user_id);

-- ============================================================================
-- Trigger: create a profile row when a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper functions used by RLS policies (SECURITY DEFINER to avoid recursion)
-- ============================================================================
create or replace function public.is_archive_member(p_archive_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.archive_members m
    where m.archive_id = p_archive_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_archive_owner(p_archive_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.archives a
    where a.id = p_archive_id and a.owner_id = auth.uid()
  );
$$;

create or replace function public.can_contribute_to_archive(p_archive_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.archive_members m
    where m.archive_id = p_archive_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'contributor')
  );
$$;

create or replace function public.can_view_story(p_story_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stories s
    where s.id = p_story_id
      and (
        s.owner_id = auth.uid()
        or (s.privacy = 'archive_members' and public.is_archive_member(s.archive_id))
        or (
          s.privacy = 'selected_members'
          and exists (
            select 1 from public.story_permissions sp
            where sp.story_id = s.id and sp.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.archives            enable row level security;
alter table public.archive_members     enable row level security;
alter table public.archive_invitations enable row level security;
alter table public.stories             enable row level security;
alter table public.story_people        enable row level security;
alter table public.tags                enable row level security;
alter table public.story_tags          enable row level security;
alter table public.story_permissions   enable row level security;

-- ---- profiles --------------------------------------------------------------
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- archives --------------------------------------------------------------
create policy "archives_select_members"
  on public.archives for select
  using (owner_id = auth.uid() or public.is_archive_member(id));

create policy "archives_insert_own"
  on public.archives for insert
  with check (owner_id = auth.uid());

create policy "archives_update_owner"
  on public.archives for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "archives_delete_owner"
  on public.archives for delete
  using (owner_id = auth.uid());

-- ---- archive_members -------------------------------------------------------
create policy "archive_members_select_own_or_owner"
  on public.archive_members for select
  using (user_id = auth.uid() or public.is_archive_owner(archive_id));

create policy "archive_members_insert_owner"
  on public.archive_members for insert
  with check (public.is_archive_owner(archive_id));

create policy "archive_members_update_owner"
  on public.archive_members for update
  using (public.is_archive_owner(archive_id))
  with check (public.is_archive_owner(archive_id));

create policy "archive_members_delete_owner"
  on public.archive_members for delete
  using (public.is_archive_owner(archive_id));

-- ---- archive_invitations ---------------------------------------------------
create policy "archive_invitations_select_by_token_or_owner"
  on public.archive_invitations for select
  using (public.is_archive_owner(archive_id) or public.can_contribute_to_archive(archive_id));

create policy "archive_invitations_insert_contributor"
  on public.archive_invitations for insert
  with check (public.can_contribute_to_archive(archive_id));

create policy "archive_invitations_update_owner"
  on public.archive_invitations for update
  using (public.is_archive_owner(archive_id))
  with check (public.is_archive_owner(archive_id));

create policy "archive_invitations_delete_owner"
  on public.archive_invitations for delete
  using (public.is_archive_owner(archive_id));

-- ---- stories ---------------------------------------------------------------
create policy "stories_select_by_access"
  on public.stories for select
  using (public.can_view_story(id));

create policy "stories_insert_contributor"
  on public.stories for insert
  with check (owner_id = auth.uid() and public.can_contribute_to_archive(archive_id));

create policy "stories_update_owner"
  on public.stories for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "stories_delete_owner"
  on public.stories for delete
  using (owner_id = auth.uid());

-- ---- story_people ----------------------------------------------------------
create policy "story_people_select_by_access"
  on public.story_people for select
  using (public.can_view_story(story_id));

create policy "story_people_write_owner"
  on public.story_people for all
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  );

-- ---- tags ------------------------------------------------------------------
create policy "tags_select_members"
  on public.tags for select
  using (public.is_archive_member(archive_id) or public.is_archive_owner(archive_id));

create policy "tags_insert_contributor"
  on public.tags for insert
  with check (public.can_contribute_to_archive(archive_id));

create policy "tags_delete_owner"
  on public.tags for delete
  using (public.is_archive_owner(archive_id));

-- ---- story_tags ------------------------------------------------------------
create policy "story_tags_select_by_access"
  on public.story_tags for select
  using (public.can_view_story(story_id));

create policy "story_tags_write_owner"
  on public.story_tags for all
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  );

-- ---- story_permissions -----------------------------------------------------
create policy "story_permissions_select_by_access"
  on public.story_permissions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  );

create policy "story_permissions_write_owner"
  on public.story_permissions for all
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Storage: audio-recordings bucket + policies
-- Create the bucket (id = 'audio-recordings', private). If it already exists
-- this is a no-op.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('audio-recordings', 'audio-recordings', false)
on conflict (id) do nothing;

-- Authenticated users may upload objects to the bucket.
create policy "audio_recordings_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'audio-recordings');

-- Authenticated users may read/update/delete objects they own.
-- (Finer-grained, story-privacy-aware access is enforced in later phases via
--  signed URLs generated on the server; these stubs cover Phase 1.)
create policy "audio_recordings_select_owner"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'audio-recordings' and owner = auth.uid());

create policy "audio_recordings_update_owner"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'audio-recordings' and owner = auth.uid())
  with check (bucket_id = 'audio-recordings' and owner = auth.uid());

create policy "audio_recordings_delete_owner"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'audio-recordings' and owner = auth.uid());
