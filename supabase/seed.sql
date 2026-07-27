-- ============================================================================
-- EverMoments — seed data (optional)
-- ----------------------------------------------------------------------------
-- Seeding meaningful rows requires real auth.users records (profiles are keyed
-- to auth.users), so there is nothing to insert automatically here for Phase 1.
--
-- To create sample data locally:
--   1. Sign up a user through the app (a profile row is created by the
--      on_auth_user_created trigger).
--   2. Replace <USER_ID> below with that user's auth.users id and uncomment.
-- ============================================================================

-- insert into public.archives (name, description, owner_id)
-- values ('Our Family Archive', 'Stories from the whole family.', '<USER_ID>');

-- After creating the archive, add the owner as a member:
-- insert into public.archive_members (archive_id, user_id, role, joined_at)
-- select id, owner_id, 'owner', now() from public.archives
-- where owner_id = '<USER_ID>';
