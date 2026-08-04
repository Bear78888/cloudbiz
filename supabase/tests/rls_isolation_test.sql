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
  customer_a uuid;
  job_a uuid;
  job_b uuid;
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

  -- ---------------------------------------------------------------------
  -- Job Tracker (§13, §25.2). Tenant isolation, staff access (§11.3), and
  -- the append-only activity trail (§13.11).
  -- ---------------------------------------------------------------------

  -- 9. Owner A creates a customer and a job; the trail is written for them.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  insert into public.customers (organization_id, name, phone, email, preferred_locale, lead_source)
  values (org_a, 'John Smith', '+13105550101', 'john@example.com', 'en', 'referral')
  returning id into customer_a;

  insert into public.jobs (organization_id, customer_id, title, service, status, estimate_amount)
  values (org_a, customer_a, 'Faucet replacement', 'Plumbing', 'new_lead', 280.00)
  returning id into job_a;

  if not exists (
    select 1 from public.job_activities
    where job_id = job_a and event_type = 'job.created' and actor_id = '00000000-0000-0000-0000-00000000000a'
  ) then
    raise exception 'FAIL(9a): job.created activity was not recorded';
  end if;
  if not exists (
    select 1 from public.job_activities
    where customer_id = customer_a and event_type = 'customer.created'
  ) then
    raise exception 'FAIL(9b): customer.created activity was not recorded';
  end if;

  -- Phone search survives formatting (§13.8): the generated digits column
  -- makes every way of writing the number the same string.
  if not exists (
    select 1 from public.customers where id = customer_a and phone_digits = '13105550101'
  ) then
    raise exception 'FAIL(9b2): phone_digits was not generated from the stored phone';
  end if;
  if not exists (
    select 1 from public.customers
    where organization_id = org_a and phone_digits like '%' || '3105550101'
  ) then
    raise exception 'FAIL(9b3): a differently formatted phone does not match the stored one';
  end if;

  -- A status change and a soft delete each get their own event (§13.11, §14.12).
  update public.jobs set status = 'estimate_sent' where id = job_a;
  if not exists (
    select 1 from public.job_activities
    where job_id = job_a and event_type = 'job.status_changed'
      and metadata ->> 'from' = 'new_lead' and metadata ->> 'to' = 'estimate_sent'
  ) then
    raise exception 'FAIL(9c): job.status_changed activity missing or lacks the transition';
  end if;

  update public.jobs set deleted_at = now() where id = job_a;
  if not exists (select 1 from public.job_activities where job_id = job_a and event_type = 'job.deleted') then
    raise exception 'FAIL(9d): job.deleted activity was not recorded';
  end if;
  update public.jobs set deleted_at = null where id = job_a;
  if not exists (select 1 from public.job_activities where job_id = job_a and event_type = 'job.restored') then
    raise exception 'FAIL(9e): job.restored activity was not recorded';
  end if;
  -- Soft delete only: the row survives (§14.12).
  if not exists (select 1 from public.jobs where id = job_a) then
    raise exception 'FAIL(9f): soft-deleted job disappeared from the table';
  end if;

  -- 10. Owner B creates their own job and sees nothing of organization A.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  insert into public.jobs (organization_id, title, status)
  values (org_b, 'Deep clean', 'scheduled')
  returning id into job_b;

  select count(*) into visible_count from public.jobs;
  if visible_count <> 1 then
    raise exception 'FAIL(10a): user B sees % jobs, expected 1', visible_count;
  end if;
  if exists (select 1 from public.customers where organization_id = org_a) then
    raise exception 'FAIL(10b): user B can read customers of organization A';
  end if;
  if exists (select 1 from public.job_activities where organization_id = org_a) then
    raise exception 'FAIL(10c): user B can read the activity trail of organization A';
  end if;
  -- ...and the check above is not vacuous: B does see their own trail.
  if not exists (select 1 from public.job_activities where job_id = job_b) then
    raise exception 'FAIL(10c2): user B cannot read their own activity trail';
  end if;

  -- Cross-tenant writes are rejected by the WITH CHECK clause.
  mutation_blocked := false;
  begin
    insert into public.jobs (organization_id, title) values (org_a, 'Injected job');
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(10d): user B inserted a job into organization A';
  end if;

  update public.jobs set title = 'Hijacked' where id = job_a;
  if found then
    raise exception 'FAIL(10e): user B updated a job of organization A';
  end if;

  -- 11. The activity trail is read-only from the client: no INSERT policy,
  -- and the append-only trigger blocks edits even for the table owner.
  mutation_blocked := false;
  begin
    insert into public.job_activities (organization_id, job_id, event_type)
    values (org_b, job_b, 'job.updated');
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(11a): a client forged a job_activities row';
  end if;

  perform pg_temp.act_as_postgres();
  mutation_blocked := false;
  begin
    update public.job_activities set event_type = 'job.updated' where job_id = job_a;
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(11b): job_activities update was not blocked';
  end if;
  mutation_blocked := false;
  begin
    delete from public.job_activities where job_id = job_a;
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(11c): job_activities delete was not blocked';
  end if;

  -- 12. Staff work the Job Tracker (§11.3) but stay inside their organization.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
  if not exists (select 1 from public.jobs where id = job_a) then
    raise exception 'FAIL(12a): staff member cannot read jobs of their own organization';
  end if;
  update public.jobs set status = 'scheduled' where id = job_a;
  if not found then
    raise exception 'FAIL(12b): staff member cannot change a job status';
  end if;
  if exists (select 1 from public.jobs where organization_id = org_b) then
    raise exception 'FAIL(12c): staff member of A can read jobs of organization B';
  end if;

  -- 13. Organizations are deletable while their history stays intact
  -- (regression: an FK ON DELETE SET NULL used to collide with the
  -- immutability trigger and block deletion entirely — same reason
  -- job_activities carries no foreign keys).
  perform pg_temp.act_as_postgres();
  delete from public.organizations where id = org_b;
  if exists (select 1 from public.organizations where id = org_b) then
    raise exception 'FAIL(13a): organization B was not deleted';
  end if;
  if not exists (select 1 from public.audit_logs where organization_id = org_b) then
    raise exception 'FAIL(13b): audit history of deleted organization B was lost';
  end if;
  if exists (select 1 from public.jobs where organization_id = org_b) then
    raise exception 'FAIL(13c): jobs of deleted organization B were not removed';
  end if;
  if not exists (select 1 from public.job_activities where organization_id = org_b) then
    raise exception 'FAIL(13d): activity history of deleted organization B was lost';
  end if;

  -- 14. Unauthenticated (anon) sees nothing.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
  select count(*) into visible_count from public.organizations;
  if visible_count <> 0 then
    raise exception 'FAIL(14a): anon sees % organizations', visible_count;
  end if;
  select count(*) into visible_count from public.jobs;
  if visible_count <> 0 then
    raise exception 'FAIL(14b): anon sees % jobs', visible_count;
  end if;
  select count(*) into visible_count from public.customers;
  if visible_count <> 0 then
    raise exception 'FAIL(14c): anon sees % customers', visible_count;
  end if;
  select count(*) into visible_count from public.job_activities;
  if visible_count <> 0 then
    raise exception 'FAIL(14d): anon sees % job activities', visible_count;
  end if;

  perform pg_temp.act_as_postgres();
  raise notice 'RLS isolation tests passed';
end;
$$;

rollback;
