-- ============================================================================
-- EverMoments — Initial schema (Phases 1 & 2)
-- Family audio archive: profiles, archives, membership, invitations, stories,
-- tags, sharing, and storage.
--
-- Run this in the Supabase SQL editor for a fresh project. It is the single
-- source of truth for the schema: all Phase 2 authorization fixes are folded
-- in here (001 was never deployed, so there is no migration history to
-- preserve). The script is written to be safe on a fresh database and
-- re-runnable: policies and triggers are dropped before being recreated,
-- tables/indexes use IF NOT EXISTS, and functions use CREATE OR REPLACE.
--
-- ----------------------------------------------------------------------------
-- AUTHORIZATION MATRIX (enforced by RLS + SECURITY DEFINER functions below)
-- ----------------------------------------------------------------------------
--  Resource / action        | owner | contributor | viewer | invited (pre-join)
--  --------------------------|-------|-------------|--------|-------------------
--  archive: view            |  yes  |     yes     |  yes   |   no
--  archive: edit/delete     |  yes  |     no      |  no    |   no
--  member list: view        |  yes  |     yes     |  yes   |   no
--  member: add/remove/role  |  yes  |     no      |  no    |   no
--  owner demote/remove      |  NEVER (blocked by trigger + RPC guards)
--  invitation: create/view/ |  yes  |     no      |  no    |   no
--    revoke/manage          |       |             |        |
--  invitation: accept       |  only the authenticated user whose email matches
--  story: view              |  by can_view_story() (owner / archive_members /
--                             selected_members)
--  story: create            |  owner+contributor (owner_id = self)
--  story: edit/delete       |  story owner only; moving to another archive
--                             requires contributor access to the destination
--  selected story viewers   |  must be members of the story's archive
--  storage (audio bucket)   |  private; upload only under own uid/ path;
--                             read/update/delete only object owner
-- ----------------------------------------------------------------------------
-- Invitation tokens: the application generates a high-entropy random token and
-- stores ONLY its SHA-256 hash (token_hash). The plaintext token appears only
-- in the shareable link and is never persisted or logged.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "moddatetime" schema extensions;

-- ============================================================================
-- Helper: updated_at trigger function
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
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

drop trigger if exists profiles_set_updated_at on public.profiles;
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

drop trigger if exists archives_set_updated_at on public.archives;
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

-- Exactly one owner membership per archive.
create unique index if not exists archive_members_one_owner_per_archive
  on public.archive_members (archive_id)
  where role = 'owner';

-- ============================================================================
-- Table: archive_invitations
--   * token_hash: SHA-256 hash of the token (plaintext is never stored)
--   * expires_at: required, defaults to 14 days out
--   * revoked_at: distinguishes revoked from merely invalid/expired
-- ============================================================================
create table if not exists public.archive_invitations (
  id          uuid primary key default gen_random_uuid(),
  archive_id  uuid not null references public.archives (id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('contributor', 'viewer')),
  token_hash  text not null unique,
  invited_by  uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);

create index if not exists archive_invitations_archive_id_idx on public.archive_invitations (archive_id);
create index if not exists archive_invitations_email_idx on public.archive_invitations (email);
create index if not exists archive_invitations_active_idx
  on public.archive_invitations (archive_id)
  where accepted_at is null and revoked_at is null;

-- Only one ACTIVE (pending) invitation per (archive, normalized email).
create unique index if not exists archive_invitations_unique_pending
  on public.archive_invitations (archive_id, lower(email))
  where accepted_at is null and revoked_at is null;

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

drop trigger if exists stories_set_updated_at on public.stories;
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
-- Helper functions used by RLS policies (SECURITY DEFINER to avoid recursion
-- between profiles / archives / archive_members).
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

-- Do auth.uid() and p_user_id share at least one archive? (for profile reads)
create or replace function public.shares_archive_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.archive_members me
    join public.archive_members other on other.archive_id = me.archive_id
    where me.user_id = auth.uid()
      and other.user_id = p_user_id
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
          -- Selected viewers keep access only while they are BOTH explicitly
          -- selected AND still a current member of the story's archive.
          and public.is_archive_member(s.archive_id)
          and exists (
            select 1 from public.story_permissions sp
            where sp.story_id = s.id and sp.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- ============================================================================
-- Trigger: protect the owner membership row + block promotion to owner
-- ============================================================================
create or replace function public.protect_archive_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' then
      raise exception 'cannot_demote_owner';
    end if;
    if new.role = 'owner' and old.role <> 'owner' then
      raise exception 'cannot_assign_owner';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- Block direct removal of the owner membership, but allow the row to be
    -- removed by ON DELETE CASCADE when the archive itself is being deleted.
    -- During a cascade the parent archive row is already gone, so its absence
    -- distinguishes a legitimate archive deletion from a direct owner delete.
    if old.role = 'owner'
       and exists (select 1 from public.archives a where a.id = old.archive_id) then
      raise exception 'cannot_remove_owner';
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists archive_members_protect_owner on public.archive_members;
create trigger archive_members_protect_owner
  before update or delete on public.archive_members
  for each row execute function public.protect_archive_owner();

-- ============================================================================
-- Trigger: when a story is moved to another archive, require contributor
-- access to the destination archive.
-- ============================================================================
create or replace function public.stories_guard_archive_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archive_id is distinct from old.archive_id then
    if not public.can_contribute_to_archive(new.archive_id) then
      raise exception 'not_authorized';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stories_guard_archive_change on public.stories;
create trigger stories_guard_archive_change
  before update on public.stories
  for each row execute function public.stories_guard_archive_change();

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
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
  on public.profiles for select
  using (id = auth.uid() or public.shares_archive_with(id));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- archives --------------------------------------------------------------
drop policy if exists "archives_select_members" on public.archives;
create policy "archives_select_members"
  on public.archives for select
  using (owner_id = auth.uid() or public.is_archive_member(id));

drop policy if exists "archives_insert_own" on public.archives;
create policy "archives_insert_own"
  on public.archives for insert
  with check (owner_id = auth.uid());

drop policy if exists "archives_update_owner" on public.archives;
create policy "archives_update_owner"
  on public.archives for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "archives_delete_owner" on public.archives;
create policy "archives_delete_owner"
  on public.archives for delete
  using (owner_id = auth.uid());

-- ---- archive_members -------------------------------------------------------
-- Any member of the archive can read the full member list.
drop policy if exists "archive_members_select_own_or_owner" on public.archive_members;
drop policy if exists "archive_members_select_member" on public.archive_members;
create policy "archive_members_select_member"
  on public.archive_members for select
  using (public.is_archive_member(archive_id));

drop policy if exists "archive_members_insert_owner" on public.archive_members;
create policy "archive_members_insert_owner"
  on public.archive_members for insert
  with check (public.is_archive_owner(archive_id));

drop policy if exists "archive_members_update_owner" on public.archive_members;
create policy "archive_members_update_owner"
  on public.archive_members for update
  using (public.is_archive_owner(archive_id))
  with check (public.is_archive_owner(archive_id));

drop policy if exists "archive_members_delete_owner" on public.archive_members;
create policy "archive_members_delete_owner"
  on public.archive_members for delete
  using (public.is_archive_owner(archive_id));

-- ---- archive_invitations (owner-only for every direct operation) -----------
drop policy if exists "archive_invitations_select_by_token_or_owner" on public.archive_invitations;
drop policy if exists "archive_invitations_select_owner" on public.archive_invitations;
create policy "archive_invitations_select_owner"
  on public.archive_invitations for select
  using (public.is_archive_owner(archive_id));

drop policy if exists "archive_invitations_insert_contributor" on public.archive_invitations;
drop policy if exists "archive_invitations_insert_owner" on public.archive_invitations;
create policy "archive_invitations_insert_owner"
  on public.archive_invitations for insert
  with check (public.is_archive_owner(archive_id));

drop policy if exists "archive_invitations_update_owner" on public.archive_invitations;
create policy "archive_invitations_update_owner"
  on public.archive_invitations for update
  using (public.is_archive_owner(archive_id))
  with check (public.is_archive_owner(archive_id));

drop policy if exists "archive_invitations_delete_owner" on public.archive_invitations;
create policy "archive_invitations_delete_owner"
  on public.archive_invitations for delete
  using (public.is_archive_owner(archive_id));

-- ---- stories ---------------------------------------------------------------
drop policy if exists "stories_select_by_access" on public.stories;
create policy "stories_select_by_access"
  on public.stories for select
  using (public.can_view_story(id));

drop policy if exists "stories_insert_contributor" on public.stories;
create policy "stories_insert_contributor"
  on public.stories for insert
  with check (owner_id = auth.uid() and public.can_contribute_to_archive(archive_id));

-- Owner-only editing. Moving a story to a new archive additionally requires
-- contributor access to the destination (enforced by trigger above).
drop policy if exists "stories_update_owner" on public.stories;
create policy "stories_update_owner"
  on public.stories for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "stories_delete_owner" on public.stories;
create policy "stories_delete_owner"
  on public.stories for delete
  using (owner_id = auth.uid());

-- ---- story_people ----------------------------------------------------------
drop policy if exists "story_people_select_by_access" on public.story_people;
create policy "story_people_select_by_access"
  on public.story_people for select
  using (public.can_view_story(story_id));

drop policy if exists "story_people_write_owner" on public.story_people;
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
drop policy if exists "tags_select_members" on public.tags;
create policy "tags_select_members"
  on public.tags for select
  using (public.is_archive_member(archive_id) or public.is_archive_owner(archive_id));

drop policy if exists "tags_insert_contributor" on public.tags;
create policy "tags_insert_contributor"
  on public.tags for insert
  with check (public.can_contribute_to_archive(archive_id));

drop policy if exists "tags_delete_owner" on public.tags;
create policy "tags_delete_owner"
  on public.tags for delete
  using (public.is_archive_owner(archive_id));

-- ---- story_tags ------------------------------------------------------------
drop policy if exists "story_tags_select_by_access" on public.story_tags;
create policy "story_tags_select_by_access"
  on public.story_tags for select
  using (public.can_view_story(story_id));

drop policy if exists "story_tags_write_owner" on public.story_tags;
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
-- Selected viewers must be members of the story's archive.
drop policy if exists "story_permissions_select_by_access" on public.story_permissions;
create policy "story_permissions_select_by_access"
  on public.story_permissions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "story_permissions_write_owner" on public.story_permissions;
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
    and exists (
      select 1
      from public.stories s
      join public.archive_members m on m.archive_id = s.archive_id
      where s.id = story_permissions.story_id
        and m.user_id = story_permissions.user_id
    )
  );

-- ============================================================================
-- Membership / invitation RPCs (SECURITY DEFINER; PUBLIC execute revoked,
-- authenticated granted). These are the ONLY sanctioned write paths for
-- creating archives, listing members, and managing invitations.
-- ============================================================================

-- Atomic archive creation (archive + owner membership together).
create or replace function public.create_archive_with_owner(
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archive_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_name';
  end if;

  insert into public.archives (name, description, owner_id)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), auth.uid())
  returning id into v_archive_id;

  insert into public.archive_members (archive_id, user_id, role, invited_by, joined_at)
  values (v_archive_id, auth.uid(), 'owner', auth.uid(), now())
  on conflict (archive_id, user_id) do nothing;

  return v_archive_id;
end;
$$;

-- Member list with profile + email, only for members of the archive.
create or replace function public.get_archive_members(p_archive_id uuid)
returns table (
  id         uuid,
  user_id    uuid,
  role       text,
  joined_at  timestamptz,
  created_at timestamptz,
  full_name  text,
  avatar_url text,
  email      text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_archive_member(p_archive_id) then
    raise exception 'not_authorized';
  end if;

  return query
    select
      m.id, m.user_id, m.role, m.joined_at, m.created_at,
      p.full_name, p.avatar_url, u.email::text
    from public.archive_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.archive_id = p_archive_id
    order by
      case when m.role = 'owner' then 0
           when m.role = 'contributor' then 1
           else 2 end,
      p.full_name nulls last,
      m.created_at;
end;
$$;

-- Create an invitation (owner-only). Caller passes the SHA-256 token hash.
create or replace function public.create_invitation(
  p_archive_id uuid,
  p_email text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_invitation_id uuid;
begin
  if not public.is_archive_owner(p_archive_id) then
    raise exception 'not_authorized';
  end if;
  if p_role not in ('contributor', 'viewer') then
    raise exception 'invalid_role';
  end if;
  if v_email = '' then
    raise exception 'invalid_email';
  end if;
  if coalesce(btrim(p_token_hash), '') = '' then
    raise exception 'invalid_token';
  end if;

  -- Already a member of this archive?
  if exists (
    select 1
    from public.archive_members m
    join auth.users u on u.id = m.user_id
    where m.archive_id = p_archive_id
      and lower(u.email) = v_email
  ) then
    raise exception 'already_member';
  end if;

  -- Already has an active pending invitation?
  if exists (
    select 1
    from public.archive_invitations i
    where i.archive_id = p_archive_id
      and lower(i.email) = v_email
      and i.accepted_at is null
      and i.revoked_at is null
  ) then
    raise exception 'already_invited';
  end if;

  insert into public.archive_invitations
    (archive_id, email, role, token_hash, invited_by, expires_at)
  values
    (p_archive_id, v_email, p_role, p_token_hash, auth.uid(),
     coalesce(p_expires_at, now() + interval '14 days'))
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

-- Revoke a pending invitation (owner-only).
create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archive_id uuid;
begin
  select archive_id into v_archive_id
  from public.archive_invitations
  where id = p_invitation_id;

  if v_archive_id is null then
    raise exception 'not_found';
  end if;
  if not public.is_archive_owner(v_archive_id) then
    raise exception 'not_authorized';
  end if;

  update public.archive_invitations
  set revoked_at = now()
  where id = p_invitation_id
    and accepted_at is null
    and revoked_at is null;
end;
$$;

-- Safe lookup for the acceptance page. Caller passes the SHA-256 token hash.
-- Returns a status the UI can branch on without leaking other archives' data.
create or replace function public.get_invitation_by_token(p_token_hash text)
returns table (
  invitation_id uuid,
  archive_id    uuid,
  archive_name  text,
  role          text,
  email         text,
  status        text,
  inviter_name  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv          public.archive_invitations%rowtype;
  v_email        text;
  v_archive_name text;
  v_inviter_name text;
  v_status       text;
begin
  select * into v_inv
  from public.archive_invitations
  where token_hash = p_token_hash;

  if not found then
    return query select null::uuid, null::uuid, null::text, null::text,
                        null::text, 'invalid'::text, null::text;
    return;
  end if;

  select u.email::text into v_email from auth.users u where u.id = auth.uid();
  select a.name into v_archive_name from public.archives a where a.id = v_inv.archive_id;
  select p.full_name into v_inviter_name from public.profiles p where p.id = v_inv.invited_by;

  if v_inv.accepted_at is not null then
    v_status := 'accepted';
  elsif v_inv.revoked_at is not null then
    v_status := 'revoked';
  elsif v_inv.expires_at is not null and v_inv.expires_at < now() then
    v_status := 'expired';
  elsif lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    v_status := 'wrong_email';
  else
    v_status := 'valid';
  end if;

  return query select
    v_inv.id, v_inv.archive_id, v_archive_name, v_inv.role,
    v_inv.email, v_status, v_inviter_name;
end;
$$;

-- Accept an invitation (only the invited email may accept). Atomic.
create or replace function public.accept_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv   public.archive_invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv
  from public.archive_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invitation_invalid';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation_already_accepted';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation_revoked';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'invitation_expired';
  end if;

  select u.email::text into v_email from auth.users u where u.id = auth.uid();
  if lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'invitation_wrong_email';
  end if;

  -- Already-a-member case: treat acceptance as idempotent success rather than
  -- raising (a raise would roll back within the caller's transaction, leaving
  -- the token still pending and misleadingly reusable). The caller already has
  -- access, so we consume the token (mark it accepted) and return the archive
  -- id. A second attempt then fails cleanly with 'invitation_already_accepted'.
  if exists (
    select 1 from public.archive_members m
    where m.archive_id = v_inv.archive_id and m.user_id = auth.uid()
  ) then
    update public.archive_invitations
    set accepted_at = now()
    where id = v_inv.id;
    return v_inv.archive_id;
  end if;

  insert into public.archive_members (archive_id, user_id, role, invited_by, joined_at)
  values (v_inv.archive_id, auth.uid(), v_inv.role, v_inv.invited_by, now());

  update public.archive_invitations
  set accepted_at = now()
  where id = v_inv.id;

  return v_inv.archive_id;
end;
$$;

-- Change a member's role (owner-only; cannot touch owner row or self;
-- cannot assign owner). The protect trigger is a second line of defense.
create or replace function public.update_member_role(
  p_member_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.archive_members%rowtype;
begin
  select * into v_member from public.archive_members where id = p_member_id;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.is_archive_owner(v_member.archive_id) then
    raise exception 'not_authorized';
  end if;
  if p_role not in ('contributor', 'viewer') then
    raise exception 'invalid_role';
  end if;
  if v_member.role = 'owner' then
    raise exception 'cannot_modify_owner';
  end if;
  if v_member.user_id = auth.uid() then
    raise exception 'cannot_modify_self';
  end if;

  update public.archive_members set role = p_role where id = p_member_id;
end;
$$;

-- Remove a member (owner-only; cannot remove owner row or self).
create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.archive_members%rowtype;
begin
  select * into v_member from public.archive_members where id = p_member_id;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.is_archive_owner(v_member.archive_id) then
    raise exception 'not_authorized';
  end if;
  if v_member.role = 'owner' then
    raise exception 'cannot_remove_owner';
  end if;
  if v_member.user_id = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;

  delete from public.archive_members where id = p_member_id;
end;
$$;

-- ============================================================================
-- Execute privileges: revoke PUBLIC, grant to authenticated only.
-- ============================================================================
revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.protect_archive_owner() from public;
revoke all on function public.stories_guard_archive_change() from public;

revoke all on function public.is_archive_member(uuid) from public;
revoke all on function public.is_archive_owner(uuid) from public;
revoke all on function public.can_contribute_to_archive(uuid) from public;
revoke all on function public.shares_archive_with(uuid) from public;
revoke all on function public.can_view_story(uuid) from public;
grant execute on function public.is_archive_member(uuid) to authenticated;
grant execute on function public.is_archive_owner(uuid) to authenticated;
grant execute on function public.can_contribute_to_archive(uuid) to authenticated;
grant execute on function public.shares_archive_with(uuid) to authenticated;
grant execute on function public.can_view_story(uuid) to authenticated;

revoke all on function public.create_archive_with_owner(text, text) from public;
revoke all on function public.get_archive_members(uuid) from public;
revoke all on function public.create_invitation(uuid, text, text, text, timestamptz) from public;
revoke all on function public.revoke_invitation(uuid) from public;
revoke all on function public.get_invitation_by_token(text) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.update_member_role(uuid, text) from public;
revoke all on function public.remove_member(uuid) from public;
grant execute on function public.create_archive_with_owner(text, text) to authenticated;
grant execute on function public.get_archive_members(uuid) to authenticated;
grant execute on function public.create_invitation(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.get_invitation_by_token(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.update_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;

-- ============================================================================
-- Storage: audio-recordings bucket + policies (PRIVATE; per-user path)
-- Uploads must live under a top-level folder equal to the user's uid, e.g.
--   audio-recordings/<uid>/<story-id>/<file>.
-- Size limit 50 MB; audio MIME types only (best-effort at the bucket level).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio-recordings',
  'audio-recordings',
  false,
  52428800,
  array['audio/webm','audio/mpeg','audio/mp3','audio/mp4','audio/m4a',
        'audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "audio_recordings_insert_authenticated" on storage.objects;
create policy "audio_recordings_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'audio-recordings'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_recordings_select_owner" on storage.objects;
create policy "audio_recordings_select_owner"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'audio-recordings' and owner = auth.uid());

drop policy if exists "audio_recordings_update_owner" on storage.objects;
create policy "audio_recordings_update_owner"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'audio-recordings' and owner = auth.uid())
  with check (
    bucket_id = 'audio-recordings'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "audio_recordings_delete_owner" on storage.objects;
create policy "audio_recordings_delete_owner"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'audio-recordings' and owner = auth.uid());
