-- ============================================================================
-- LOCAL-ONLY stubs to run the migration + authz checks on a plain PostgreSQL
-- instance (no Supabase). Supabase already provides auth/storage schemas, the
-- authenticated/anon roles, auth.uid(), and table grants — do NOT run this on
-- Supabase. It exists purely so scripts/authz-checks.sql can be executed in CI
-- or locally against a vanilla Postgres server.
-- ============================================================================
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Mirrors Supabase's auth.uid(): reads the JWT "sub" claim from the request GUC.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

-- Grants Supabase normally provisions for the authenticated role.
grant usage on schema public, auth, storage to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema auth to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
