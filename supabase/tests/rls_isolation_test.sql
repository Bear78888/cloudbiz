-- Cross-tenant isolation tests (§26.1, §37.4). Self-checking: any failed
-- assertion raises an exception, so a non-zero psql exit code means failure.
-- Run against a database prepared with supabase_shim.sql + all migrations.
--
--   psql ... -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation_test.sql

begin;

-- Two auth users (the auth trigger mirrors them into public.profiles).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.com', '{"preferred_locale": "en"}'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.com', '{"preferred_locale": "es"}');

create or replace function pg_temp.act_as(user_id text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', user_id, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.act_as_postgres()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

do $$
declare
  org_a uuid;
  org_b uuid;
  visible_count integer;
  mutation_blocked boolean;
begin
  -- User A creates an organization through the RPC.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  org_a := public.create_organization('Alpha Plumbing', 'plumbing', 'en');

  -- User B creates a different organization.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  org_b := public.create_organization('Beta Cleaning', 'cleaning', 'es');

  -- 1. Members see exactly their own organization.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  select count(*) into visible_count from public.organizations;
  if visible_count <> 1 then
    raise exception 'FAIL(1): user A sees % organizations, expected 1', visible_count;
  end if;
  if not exists (select 1 from public.organizations where id = org_a) then
    raise exception 'FAIL(1b): user A cannot see own organization';
  end if;

  -- 2. Cross-tenant reads return zero rows for every tenant table.
  if exists (select 1 from public.organizations where id = org_b) then
    raise exception 'FAIL(2a): user A can see organization B';
  end if;
  if exists (select 1 from public.business_profiles where organization_id = org_b) then
    raise exception 'FAIL(2b): user A can see business profile B';
  end if;
  if exists (select 1 from public.organization_members where organization_id = org_b) then
    raise exception 'FAIL(2c): user A can see members of B';
  end if;
  if exists (select 1 from public.entitlements where organization_id = org_b) then
    raise exception 'FAIL(2d): user A can see entitlements of B';
  end if;
  if exists (select 1 from public.audit_logs where organization_id = org_b) then
    raise exception 'FAIL(2e): user A can see audit logs of B';
  end if;

  -- 3. The free Job Tracker entitlement exists for the creator (§13.1).
  if not exists (
    select 1 from public.entitlements
    where organization_id = org_a and feature_code = 'job_tracker' and status = 'active'
  ) then
    raise exception 'FAIL(3): free job_tracker entitlement missing for org A';
  end if;

  -- 4. Direct INSERT into organizations is denied (creation only via RPC).
  begin
    insert into public.organizations (name, slug, trade) values ('Evil Org', 'evil-org', 'handyman');
    raise exception 'FAIL(4): direct insert into organizations was allowed';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL(4)%' then raise; end if;
      null; -- RLS violation surfaces as a check/policy error depending on version
  end;

  -- 5. User A cannot update organization B.
  update public.organizations set name = 'Hacked' where id = org_b;
  if found then
    raise exception 'FAIL(5): user A updated organization B';
  end if;

  -- 6. A cross-tenant entitlement read via the member helper is false.
  if app_private.is_member_of(org_b) then
    raise exception 'FAIL(6): is_member_of returned true for foreign org';
  end if;

  -- 7. Subscriptions are invisible to staff (owner-only): create a staff
  -- member in org A and verify they cannot read subscriptions.
  perform pg_temp.act_as_postgres();
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'staff-a@example.com');
  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (org_a, '00000000-0000-0000-0000-00000000000c', 'staff', 'active', now());
  insert into public.subscriptions (organization_id, stripe_customer_id, stripe_subscription_id, product_code, status)
  values (org_a, 'cus_test', 'sub_test', 'estimate_quote_maker', 'active');

  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
  if exists (select 1 from public.subscriptions where organization_id = org_a) then
    raise exception 'FAIL(7a): staff member can read subscriptions';
  end if;
  -- ...but staff do see entitlements (UI gating) and the org itself.
  if not exists (select 1 from public.entitlements where organization_id = org_a) then
    raise exception 'FAIL(7b): staff member cannot read entitlements';
  end if;
  if not exists (select 1 from public.organizations where id = org_a) then
    raise exception 'FAIL(7c): staff member cannot read own organization';
  end if;

  -- 8. audit_logs are immutable even for the table owner.
  perform pg_temp.act_as_postgres();
  mutation_blocked := false;
  begin
    update public.audit_logs set action = 'tampered' where organization_id = org_a;
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(8a): audit_logs update was not blocked';
  end if;
  mutation_blocked := false;
  begin
    delete from public.audit_logs where organization_id = org_a;
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(8b): audit_logs delete was not blocked';
  end if;

  -- 9. Unauthenticated (anon) sees nothing.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
  select count(*) into visible_count from public.organizations;
  if visible_count <> 0 then
    raise exception 'FAIL(9): anon sees % organizations', visible_count;
  end if;

  perform pg_temp.act_as_postgres();
  raise notice 'RLS isolation tests passed';
end;
$$;

rollback;
