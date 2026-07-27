-- ============================================================================
-- EverMoments — Authorization boundary checks
-- ----------------------------------------------------------------------------
-- Executable proof that the RLS policies and SECURITY DEFINER RPCs in
-- 001_initial_schema.sql enforce the intended authorization model. Every check
-- RAISEs and aborts the run on failure, so a clean run (exit code 0, ending in
-- "ALL AUTHORIZATION CHECKS PASSED") means every boundary held.
--
-- The whole script runs in ONE transaction and ROLLS BACK at the end, so it is
-- non-destructive.
--
-- HOW TO RUN
--   Locally (vanilla Postgres):
--     psql "$URI" -v ON_ERROR_STOP=1 -f scripts/_local_stubs.sql
--     psql "$URI" -v ON_ERROR_STOP=1 -f supabase/migrations/001_initial_schema.sql
--     psql "$URI" -v ON_ERROR_STOP=1 -f scripts/authz-checks.sql
--   On Supabase: prefer the manual two-account walkthrough in
--     scripts/AUTHORIZATION.md. Raw inserts into auth.users are not supported
--     through the SQL editor for real projects.
--
-- Identity is switched with SET LOCAL ROLE authenticated + a JWT "sub" claim,
-- exactly how Supabase evaluates auth.uid() for a signed-in user.
-- ============================================================================

begin;

-- Fixed test identities -------------------------------------------------------
--   Alice 11111111-... (archive owner)
--   Bob   22222222-... (invited viewer)
--   Carol 33333333-... (unrelated stranger)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name":"Alice Owner"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',   '{"full_name":"Bob Viewer"}'),
  ('33333333-3333-3333-3333-333333333333', 'carol@example.com', '{"full_name":"Carol Stranger"}')
on conflict (id) do nothing;

create temp table _authz (k text primary key, v text) on commit drop;
-- Local harness only: the checks below switch into the "authenticated" role,
-- so that role needs access to this scratch table (Supabase is unaffected).
grant all on _authz to authenticated;

-- Token hashes (in the app these are sha256(token); here any 64-char value works)
\set hashB '''bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'''

-- 1) Atomic archive creation (Alice) -----------------------------------------
do $$
declare v uuid; n int;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  v := public.create_archive_with_owner('Family Stories', 'Our memories');
  insert into _authz values ('archive', v::text);
  select count(*) into n from public.archive_members
    where archive_id = v and user_id = '11111111-1111-1111-1111-111111111111' and role = 'owner';
  if n <> 1 then raise exception 'FAIL 1: owner membership not created atomically'; end if;
  raise notice 'PASS 1: create_archive_with_owner created archive + owner membership';
end $$;

-- 2) Only one owner membership per archive -----------------------------------
do $$
declare v uuid;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  begin
    insert into public.archive_members (archive_id, user_id, role)
      values (v, '22222222-2222-2222-2222-222222222222', 'owner');
    raise exception 'FAIL 2: a second owner membership was allowed';
  exception when unique_violation then
    raise notice 'PASS 2: second owner membership rejected (one-owner index)';
  end;
end $$;

-- 3) Owner cannot be demoted or removed --------------------------------------
do $$
declare v uuid;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  begin
    update public.archive_members set role = 'viewer'
      where archive_id = v and role = 'owner';
    raise exception 'FAIL 3a: owner was demoted';
  exception when others then
    if sqlerrm <> 'cannot_demote_owner' then raise exception 'FAIL 3a: wrong error %', sqlerrm; end if;
  end;
  begin
    delete from public.archive_members where archive_id = v and role = 'owner';
    raise exception 'FAIL 3b: owner was removed';
  exception when others then
    if sqlerrm <> 'cannot_remove_owner' then raise exception 'FAIL 3b: wrong error %', sqlerrm; end if;
  end;
  raise notice 'PASS 3: owner cannot be demoted or removed';
end $$;

-- 4) Non-owner (Carol) cannot create an invitation ---------------------------
do $$
declare v uuid;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  begin
    perform public.create_invitation(v, 'x@example.com', 'viewer', 'x', now() + interval '1 day');
    raise exception 'FAIL 4: non-owner created an invitation';
  exception when others then
    if sqlerrm <> 'not_authorized' then raise exception 'FAIL 4: wrong error %', sqlerrm; end if;
  end;
  raise notice 'PASS 4: non-owner cannot create invitations';
end $$;

-- 5) Owner role cannot be granted via invitation -----------------------------
do $$
declare v uuid;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  begin
    perform public.create_invitation(v, 'x@example.com', 'owner', 'x', now() + interval '1 day');
    raise exception 'FAIL 5: owner role invitation allowed';
  exception when others then
    if sqlerrm <> 'invalid_role' then raise exception 'FAIL 5: wrong error %', sqlerrm; end if;
  end;
  raise notice 'PASS 5: owner role cannot be assigned via invitation';
end $$;

-- 6) Valid invitation for Bob + 7) duplicate pending rejected ----------------
do $$
declare v uuid; inv uuid;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  inv := public.create_invitation(v, 'Bob@Example.com', 'viewer',
           'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
           now() + interval '14 days');
  insert into _authz values ('invitation', inv::text);
  raise notice 'PASS 6: owner created a viewer invitation';
  begin
    perform public.create_invitation(v, 'bob@example.com', 'viewer',
             'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
             now() + interval '14 days');
    raise exception 'FAIL 7: duplicate pending invitation allowed';
  exception when others then
    if sqlerrm <> 'already_invited' then raise exception 'FAIL 7: wrong error %', sqlerrm; end if;
  end;
  raise notice 'PASS 7: duplicate pending invitation rejected';
end $$;

-- 8) Wrong email lookup shows wrong_email; 9) correct shows valid ------------
do $$
declare s text;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  select status into s from public.get_invitation_by_token(
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  if s <> 'wrong_email' then raise exception 'FAIL 8: expected wrong_email, got %', s; end if;
  raise notice 'PASS 8: token lookup reports wrong_email for the wrong account';

  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  select status into s from public.get_invitation_by_token(
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  if s <> 'valid' then raise exception 'FAIL 9: expected valid, got %', s; end if;
  raise notice 'PASS 9: token lookup reports valid for the invited account';
end $$;

-- 10) Wrong email cannot accept; 11) invited email accepts -------------------
do $$
declare v uuid; n int;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  begin
    perform public.accept_invitation('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    raise exception 'FAIL 10: wrong email accepted the invitation';
  exception when others then
    if sqlerrm <> 'invitation_wrong_email' then raise exception 'FAIL 10: wrong error %', sqlerrm; end if;
  end;
  raise notice 'PASS 10: wrong email cannot accept';

  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  perform public.accept_invitation('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  select count(*) into n from public.archive_members
    where archive_id = v and user_id = '22222222-2222-2222-2222-222222222222' and role = 'viewer';
  if n <> 1 then raise exception 'FAIL 11: Bob not added as viewer'; end if;
  raise notice 'PASS 11: invited email accepted and became a viewer';
end $$;

-- 12) Accepted tokens are not reusable; already-member accept is idempotent ---
-- Documented contract: when the caller is already a member, accept_invitation
-- does NOT raise. It consumes the token (persists accepted_at) and returns the
-- archive id, so the token is neither reusable nor left misleadingly pending,
-- and no duplicate membership is created.
do $$
declare v uuid; inv2 uuid; ret uuid; n int; acc timestamptz;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';

  -- (a) Re-accepting the already-accepted token from check 11 is rejected.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  begin
    perform public.accept_invitation('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    raise exception 'FAIL 12a: accepted invitation was reused';
  exception when others then
    if sqlerrm <> 'invitation_already_accepted' then raise exception 'FAIL 12a: wrong error %', sqlerrm; end if;
  end;

  -- (b) The already-member branch of accept_invitation. To reach it legitimately
  -- we need a still-pending invitation whose invitee has since become a member by
  -- another path (create_invitation itself blocks already-members). Use a fresh
  -- archive so Carol stays a stranger to the main archive used by later checks.
  declare w uuid;
  begin
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
    w := public.create_archive_with_owner('Idempotent Accept', null);

    -- Invite Carol while she is NOT yet a member (token pending).
    inv2 := public.create_invitation(w, 'carol@example.com', 'viewer',
              'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
              now() + interval '14 days');

    -- Owner adds Carol directly, so the pending token now targets a member.
    insert into public.archive_members (archive_id, user_id, role)
      values (w, '33333333-3333-3333-3333-333333333333', 'viewer');

    -- Carol accepts the pending token: idempotent SUCCESS (no exception), returns w.
    perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
    ret := public.accept_invitation('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');
    if ret is distinct from w then
      raise exception 'FAIL 12b: already-member accept did not return the archive id';
    end if;

    -- No duplicate membership was created (still exactly one row for Carol).
    select count(*) into n from public.archive_members
      where archive_id = w and user_id = '33333333-3333-3333-3333-333333333333';
    if n <> 1 then raise exception 'FAIL 12c: duplicate membership created (% rows)', n; end if;

    -- The token was consumed: accepted_at is persisted (read as the owner).
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
    select accepted_at into acc from public.archive_invitations where id = inv2;
    if acc is null then raise exception 'FAIL 12d: token left reusable (accepted_at null)'; end if;

    -- And it cannot be reused: a second attempt fails cleanly.
    perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
    begin
      perform public.accept_invitation('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');
      raise exception 'FAIL 12e: consumed token was reused';
    exception when others then
      if sqlerrm <> 'invitation_already_accepted' then raise exception 'FAIL 12e: wrong error %', sqlerrm; end if;
    end;

    -- Tidy up the throwaway archive (cascades Carol's membership) so she stays a
    -- stranger to Alice for the later profile-visibility checks.
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
    delete from public.archives where id = w;
  end;

  raise notice 'PASS 12: accepted tokens are not reusable; already-member accept is idempotent and consumes the token';
end $$;

-- 13) Member list visibility (member sees all; stranger sees none) -----------
do $$
declare v uuid; n int;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  select count(*) into n from public.archive_members where archive_id = v;
  if n <> 2 then raise exception 'FAIL 13a: member expected to see 2 rows, saw %', n; end if;

  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  select count(*) into n from public.archive_members where archive_id = v;
  if n <> 0 then raise exception 'FAIL 13b: stranger saw % member rows (expected 0)', n; end if;
  raise notice 'PASS 13: members see the roster; strangers see nothing';
end $$;

-- 14) Profile visibility limited to shared-archive members -------------------
do $$
declare n int;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  select count(*) into n from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL 14a: member cannot see co-member profile'; end if;

  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  select count(*) into n from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL 14b: stranger can see unrelated profile'; end if;
  raise notice 'PASS 14: profiles visible only to shared-archive members';
end $$;

-- 15) Viewer cannot edit the archive -----------------------------------------
do $$
declare v uuid; n int;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  update public.archives set name = 'Hijacked' where id = v;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 15: viewer updated the archive (% rows)', n; end if;
  raise notice 'PASS 15: viewer cannot edit the archive';
end $$;

-- 16) Role-change guards (owner-only, no owner assignment, promote/demote) ---
do $$
declare v uuid; bob uuid;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  select id into bob from public.archive_members
    where archive_id = v and user_id = '22222222-2222-2222-2222-222222222222';

  -- Viewer Bob cannot change roles.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  begin
    perform public.update_member_role(bob, 'contributor');
    raise exception 'FAIL 16a: viewer changed a role';
  exception when others then
    if sqlerrm <> 'not_authorized' then raise exception 'FAIL 16a: wrong error %', sqlerrm; end if;
  end;

  -- Owner cannot promote a member to owner via the RPC.
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  begin
    perform public.update_member_role(bob, 'owner');
    raise exception 'FAIL 16b: member promoted to owner';
  exception when others then
    if sqlerrm <> 'invalid_role' then raise exception 'FAIL 16b: wrong error %', sqlerrm; end if;
  end;

  -- Owner CAN legitimately promote a viewer to contributor.
  perform public.update_member_role(bob, 'contributor');
  raise notice 'PASS 16: role changes are owner-only and can never mint an owner';
end $$;

-- 17) Removal guards ---------------------------------------------------------
do $$
declare v uuid; alice uuid; bob uuid; n int;
begin
  select _authz.v::uuid into v from _authz where k = 'archive';
  select id into alice from public.archive_members
    where archive_id = v and user_id = '11111111-1111-1111-1111-111111111111';
  select id into bob from public.archive_members
    where archive_id = v and user_id = '22222222-2222-2222-2222-222222222222';

  -- Non-owner cannot remove members.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
  begin
    perform public.remove_member(alice);
    raise exception 'FAIL 17a: non-owner removed a member';
  exception when others then
    if sqlerrm <> 'not_authorized' then raise exception 'FAIL 17a: wrong error %', sqlerrm; end if;
  end;

  -- Owner removes Bob successfully.
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
  perform public.remove_member(bob);
  select count(*) into n from public.archive_members where id = bob;
  if n <> 0 then raise exception 'FAIL 17b: member not removed'; end if;
  raise notice 'PASS 17: removal is owner-only and works for non-owner members';
end $$;

-- 18) A selected viewer loses access after removal from the archive ---------
-- Proves can_view_story() requires BOTH an explicit story_permissions row AND
-- current membership: once membership is gone, the stale permission row alone
-- must not grant access.
--
-- The fixture rows are created with table-owner privileges (RESET ROLE) rather
-- than through the RLS insert paths: the insert policies for these tables are
-- already proven by checks 1-17, and the target under test here is the
-- can_view_story() read function, evaluated below as each signed-in user.
reset role;
do $$
declare ax uuid; sid uuid;
begin
  insert into public.archives (name, owner_id)
    values ('Selected Access', '11111111-1111-1111-1111-111111111111')
    returning id into ax;
  insert into public.archive_members (archive_id, user_id, role) values
    (ax, '11111111-1111-1111-1111-111111111111', 'owner'),
    (ax, '33333333-3333-3333-3333-333333333333', 'viewer');
  insert into public.stories (archive_id, title, owner_id, privacy)
    values (ax, 'Private tale', '11111111-1111-1111-1111-111111111111', 'selected_members')
    returning id into sid;
  insert into public.story_permissions (story_id, user_id)
    values (sid, '33333333-3333-3333-3333-333333333333');
  insert into _authz values ('ax18', ax::text), ('sid18', sid::text);
end $$;

-- 18a) While a member AND selected, Carol can view the story.
do $$
declare sid uuid; ok boolean;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  select _authz.v::uuid into sid from _authz where k = 'sid18';
  select public.can_view_story(sid) into ok;
  if not ok then raise exception 'FAIL 18a: selected member could not view the story'; end if;
end $$;

-- Remove Carol from the archive; the stale story_permissions row stays behind.
reset role;
delete from public.archive_members
  where archive_id = (select v::uuid from _authz where k = 'ax18')
    and user_id = '33333333-3333-3333-3333-333333333333';
do $$
declare sid uuid; nperm int;
begin
  select _authz.v::uuid into sid from _authz where k = 'sid18';
  select count(*) into nperm from public.story_permissions
    where story_id = sid and user_id = '33333333-3333-3333-3333-333333333333';
  if nperm <> 1 then raise exception 'FAIL 18b: permission row unexpectedly gone'; end if;
end $$;

-- 18c) Still selected but no longer a member -> access is denied.
do $$
declare sid uuid; ok boolean;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
  select _authz.v::uuid into sid from _authz where k = 'sid18';
  select public.can_view_story(sid) into ok;
  if ok then raise exception 'FAIL 18c: removed member still viewed the selected story'; end if;
  raise notice 'PASS 18: a selected viewer loses access after removal from the archive';
end $$;

-- 19) Deleting an archive cascades its owner membership successfully ---------
-- Proves the owner-protection trigger blocks DIRECT owner removal but allows
-- ON DELETE CASCADE from a legitimate archive deletion. The trigger fires
-- regardless of role, so the fixture is created with table-owner privileges
-- (RESET ROLE): the block below then proves the trigger stops even a
-- privileged direct delete, while archive deletion cascades cleanly.
reset role;
do $$
declare az uuid; n int;
begin
  insert into public.archives (name, owner_id)
    values ('Disposable', '11111111-1111-1111-1111-111111111111')
    returning id into az;
  insert into public.archive_members (archive_id, user_id, role)
    values (az, '11111111-1111-1111-1111-111111111111', 'owner');

  select count(*) into n from public.archive_members where archive_id = az and role = 'owner';
  if n <> 1 then raise exception 'FAIL 19a: owner membership missing before delete'; end if;

  -- Direct deletion of the owner membership is still blocked by the trigger.
  begin
    delete from public.archive_members where archive_id = az and role = 'owner';
    raise exception 'FAIL 19b: owner membership was directly deleted';
  exception when others then
    if sqlerrm <> 'cannot_remove_owner' then raise exception 'FAIL 19b: wrong error %', sqlerrm; end if;
  end;

  -- Legitimate archive deletion succeeds and cascades the owner row.
  delete from public.archives where id = az;
  select count(*) into n from public.archive_members where archive_id = az;
  if n <> 0 then raise exception 'FAIL 19c: owner membership not cascaded (% rows)', n; end if;
  select count(*) into n from public.archives where id = az;
  if n <> 0 then raise exception 'FAIL 19d: archive not deleted'; end if;

  raise notice 'PASS 19: archive deletion cascades the owner membership; direct owner deletion stays blocked';
end $$;

do $$ begin raise notice 'ALL AUTHORIZATION CHECKS PASSED'; end $$;

rollback;
