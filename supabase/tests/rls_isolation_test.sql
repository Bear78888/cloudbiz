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
  job_outbox uuid;
  estimate_a uuid;
  import_result jsonb;
  relation_name text;
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

  -- 9g. A plain field edit — the ordinary "open a job, fix a number, save".
  --
  -- This is the `job.updated` branch, taken when status, assignee and
  -- deleted_at are all unchanged, and until 20260804000910 it raised
  -- "malformed array literal" and aborted the UPDATE: the edit was silently
  -- impossible while every check above passed. The three paths covered here
  -- before — create, status change, soft delete/restore — each return from an
  -- earlier branch and never reach that code. Covering the states around a
  -- thing is not covering the thing.
  update public.jobs
     set title = 'Faucet replacement (rev 2)', job_total = 340.00, address = '12 Oak St'
   where id = job_a;
  if not exists (select 1 from public.jobs where id = job_a and job_total = 340.00) then
    raise exception 'FAIL(9g1): a plain field edit did not persist';
  end if;
  if not exists (
    select 1 from public.job_activities
    where job_id = job_a and event_type = 'job.updated'
      and metadata -> 'fields' @> '["title"]'::jsonb
      and metadata -> 'fields' @> '["job_total"]'::jsonb
      and metadata -> 'fields' @> '["address"]'::jsonb
  ) then
    raise exception 'FAIL(9g2): job.updated missing or does not list the changed fields';
  end if;
  -- Field names only, never the values themselves (§26.6).
  if exists (
    select 1 from public.job_activities
    where job_id = job_a and event_type = 'job.updated'
      and metadata::text like '%Oak St%'
  ) then
    raise exception 'FAIL(9g3): the activity trail leaked a field value, not just its name';
  end if;

  -- The same edit path on a customer.
  update public.customers set name = 'John A. Smith', notes = 'gate code'
   where id = customer_a;
  if not exists (select 1 from public.customers where id = customer_a and name = 'John A. Smith') then
    raise exception 'FAIL(9g4): a plain customer edit did not persist';
  end if;
  if not exists (
    select 1 from public.job_activities
    where customer_id = customer_a and event_type = 'customer.updated'
      and metadata -> 'fields' @> '["name"]'::jsonb
  ) then
    raise exception 'FAIL(9g5): customer.updated missing or does not list the changed fields';
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

  -- 12b. CSV import (§14.15) runs as one atomic RPC. It is SECURITY DEFINER,
  -- so its own membership check — not RLS — is what keeps tenants apart.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  import_result := public.import_jobs(
    org_a,
    jsonb_build_array(
      jsonb_build_object(
        'customer', jsonb_build_object('name', 'John Smith', 'phone', '+1 (310) 555-0101'),
        'job', jsonb_build_object('title', 'Imported drain clean', 'status', 'scheduled')
      ),
      jsonb_build_object(
        'customer', jsonb_build_object('name', 'Maria Lopez', 'phone', '3105550202'),
        'job', jsonb_build_object('title', 'Imported water heater', 'status', 'new_lead',
                                  'job_total', '640.00')
      )
    )
  );

  if (import_result ->> 'jobs')::int <> 2 then
    raise exception 'FAIL(12b1): import created % jobs, expected 2', import_result ->> 'jobs';
  end if;
  -- John Smith already exists from check 9 with the same number written
  -- differently: he must be matched, not duplicated.
  if (import_result ->> 'customers_matched')::int <> 1 then
    raise exception 'FAIL(12b2): differently formatted phone did not match the existing customer';
  end if;
  if (import_result ->> 'customers_created')::int <> 1 then
    raise exception 'FAIL(12b3): the new customer was not created';
  end if;

  -- The trail says "imported", not a hundred "created" (§13.11).
  if not exists (
    select 1 from public.job_activities
    where organization_id = org_a and event_type = 'job.imported'
  ) then
    raise exception 'FAIL(12b4): import did not produce job.imported activities';
  end if;
  if exists (
    select 1 from public.job_activities
    where organization_id = org_a and event_type = 'job.created'
      and job_id in (select id from public.jobs where title like 'Imported%')
  ) then
    raise exception 'FAIL(12b5): imported jobs were logged as ordinary creations';
  end if;
  -- The import context is transaction-local and must not leak to later writes.
  insert into public.jobs (organization_id, title) values (org_a, 'After import');
  if not exists (
    select 1 from public.job_activities a
    join public.jobs j on j.id = a.job_id
    where j.title = 'After import' and a.event_type = 'job.created'
  ) then
    raise exception 'FAIL(12b6): the import activity context leaked past the import';
  end if;

  -- §26.6: the bulk write is audited.
  if not exists (
    select 1 from public.audit_logs
    where organization_id = org_a and action = 'jobs.imported'
  ) then
    raise exception 'FAIL(12b7): the import was not written to the audit log';
  end if;

  -- An anonymous caller cannot reach the import at all: the EXECUTE grant is
  -- revoked (20260804000700) and the function fails closed regardless.
  if has_function_privilege('anon', 'public.import_jobs(uuid, jsonb)', 'EXECUTE') then
    raise exception 'FAIL(12b7a): anon can execute import_jobs';
  end if;
  if not has_function_privilege('authenticated', 'public.import_jobs(uuid, jsonb)', 'EXECUTE') then
    raise exception 'FAIL(12b7b): authenticated cannot execute import_jobs';
  end if;

  -- Cross-tenant import is rejected by the RPC's own membership check.
  mutation_blocked := false;
  begin
    perform public.import_jobs(
      org_b,
      jsonb_build_array(jsonb_build_object(
        'customer', jsonb_build_object('name', 'Injected'),
        'job', jsonb_build_object('title', 'Injected job')
      ))
    );
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(12b8): a member of A imported into organization B';
  end if;

  -- A row the client failed to validate aborts the whole import (all or nothing).
  mutation_blocked := false;
  begin
    perform public.import_jobs(
      org_a,
      jsonb_build_array(jsonb_build_object(
        'customer', jsonb_build_object('name', 'Bad Row'),
        'job', jsonb_build_object('title', 'Bad status', 'status', 'not_a_status')
      ))
    );
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(12b9): an unknown status was accepted by the import';
  end if;
  if exists (select 1 from public.customers where name = 'Bad Row') then
    raise exception 'FAIL(12b10): a failed import left a customer behind';
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

  -- 14. Unauthenticated (anon) reads nothing. Since 20260804000800 the API
  -- roles are granted explicitly and anon is granted nothing at all, so a read
  -- is refused outright rather than returning an empty set. Either outcome
  -- means the same thing here, and the stricter one must not fail the test.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
  foreach relation_name in array array['organizations', 'jobs', 'customers', 'job_activities']
  loop
    begin
      execute format('select count(*) from public.%I', relation_name) into visible_count;
      if visible_count <> 0 then
        raise exception 'FAIL(14): anon sees % rows in %', visible_count, relation_name;
      end if;
    exception
      when insufficient_privilege then null; -- refused outright: even better
      when others then
        if sqlerrm like 'FAIL(14)%' then raise; end if;
        raise;
    end;
  end loop;

  perform pg_temp.act_as_postgres();

  -- 15. The Data API privilege matrix is exactly what 20260804000900 says.
  --
  -- Check 14 proves anon reads nothing; it cannot prove anon was not *granted*
  -- anything, because forced RLS hides an over-grant behind an empty result.
  -- That is precisely how the live project sat for a while: created back when
  -- Supabase auto-exposed everything, its default ACL handed anon full DML
  -- plus TRUNCATE on every table, and TRUNCATE answers to no policy. So this
  -- check reads the grants themselves.
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
  ) then
    raise exception 'FAIL(15a): anon holds table privileges in public: %',
      (select string_agg(distinct table_name || '=' || privilege_type, ', ')
         from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'anon');
  end if;

  -- authenticated gets a verb only where a policy backs it. Anything else is
  -- either a grant nobody meant to write or a policy nobody meant to drop —
  -- both worth failing on. DELETE on organization_members is the one verb that
  -- is granted and policied; there is no DELETE anywhere else, because removal
  -- is `deleted_at` (§14.12).
  if exists (
    select 1
      from information_schema.role_table_grants g
     where g.table_schema = 'public'
       and g.grantee = 'authenticated'
       and g.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
       and not exists (
         select 1 from pg_policies p
          where p.schemaname = 'public'
            and p.tablename = g.table_name
            and p.cmd = case g.privilege_type when 'INSERT' then 'INSERT'
                                              when 'UPDATE' then 'UPDATE'
                                              when 'DELETE' then 'DELETE'
                                              else 'SELECT' end
       )
  ) then
    raise exception 'FAIL(15b): authenticated holds a privilege with no matching policy: %',
      (select string_agg(distinct g.table_name || '=' || g.privilege_type, ', ')
         from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.grantee = 'authenticated'
          and g.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
          and not exists (
            select 1 from pg_policies p
             where p.schemaname = 'public'
               and p.tablename = g.table_name
               and p.cmd = case g.privilege_type when 'INSERT' then 'INSERT'
                                                 when 'UPDATE' then 'UPDATE'
                                                 when 'DELETE' then 'DELETE'
                                                 else 'SELECT' end
          ));
  end if;

  -- And the inverse: a policy with no grant behind it is the failure that sent
  -- every query to "permission denied for table organization_members" and a
  -- user with an organization back to onboarding, forever (§14a).
  if exists (
    select 1
      from (select distinct tablename, cmd from pg_policies where schemaname = 'public') p
     where p.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
       and not exists (
         select 1 from information_schema.role_table_grants g
          where g.table_schema = 'public'
            and g.grantee = 'authenticated'
            and g.table_name = p.tablename
            and g.privilege_type = p.cmd
       )
  ) then
    raise exception 'FAIL(15c): a policy has no grant behind it: %',
      (select string_agg(p.tablename || '=' || p.cmd, ', ')
         from (select distinct tablename, cmd from pg_policies where schemaname = 'public') p
        where p.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
          and not exists (
            select 1 from information_schema.role_table_grants g
             where g.table_schema = 'public'
               and g.grantee = 'authenticated'
               and g.table_name = p.tablename
               and g.privilege_type = p.cmd
          ));
  end if;

  -- 16. Sync outbox (§14.9, §14.11). The queue is written in the same
  -- transaction as the data change, so it cannot disagree with the database it
  -- mirrors — which also means these assertions are about the trigger, not
  -- about any worker.
  perform pg_temp.act_as_postgres();
  delete from public.sync_outbox;

  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  insert into public.jobs (organization_id, customer_id, title, status)
  values (org_a, customer_a, 'Outbox probe', 'new_lead')
  returning id into job_outbox;

  if not exists (
    select 1 from public.sync_outbox
    where entity_type = 'job' and entity_id = job_outbox
      and operation = 'upsert' and status = 'pending'
  ) then
    raise exception 'FAIL(16a): creating a job did not enqueue a sync event';
  end if;

  -- Debounce (§14.11): a burst of edits must cost one write to the sheet, not
  -- one per edit. The partial unique index collapses them into the waiting
  -- event instead of queueing three.
  update public.jobs set title = 'Outbox probe 1' where id = job_outbox;
  update public.jobs set title = 'Outbox probe 2' where id = job_outbox;
  update public.jobs set title = 'Outbox probe 3' where id = job_outbox;
  select count(*) into visible_count
    from public.sync_outbox where entity_type = 'job' and entity_id = job_outbox;
  if visible_count <> 1 then
    raise exception 'FAIL(16b): three rapid edits produced % events, expected 1 (debounce)', visible_count;
  end if;

  -- An edit that changes nothing but `updated_at` is not worth a Google API
  -- call, and must not reopen a settled event.
  perform pg_temp.act_as_postgres();
  update public.sync_outbox set status = 'synced', processed_at = now()
   where entity_type = 'job' and entity_id = job_outbox;
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  update public.jobs set title = 'Outbox probe 3' where id = job_outbox;
  if exists (
    select 1 from public.sync_outbox
    where entity_type = 'job' and entity_id = job_outbox and status <> 'synced'
  ) then
    raise exception 'FAIL(16c): a no-op save enqueued a sync event';
  end if;

  -- A real edit after the previous event was synced starts a new one; the
  -- settled event is left alone, so the history of what was sent survives.
  update public.jobs set title = 'Outbox probe 4' where id = job_outbox;
  if not exists (
    select 1 from public.sync_outbox
    where entity_type = 'job' and entity_id = job_outbox and status = 'pending'
  ) then
    raise exception 'FAIL(16d): an edit after a synced event did not enqueue a new one';
  end if;
  if not exists (
    select 1 from public.sync_outbox
    where entity_type = 'job' and entity_id = job_outbox and status = 'synced'
  ) then
    raise exception 'FAIL(16e): the already-synced event was overwritten instead of kept';
  end if;

  -- §14.12: a soft delete is still an upsert. The row is marked Deleted = TRUE
  -- in the sheet, not removed from it — dropping the row would lose the record
  -- the owner may still be looking at.
  perform pg_temp.act_as_postgres();
  update public.sync_outbox set status = 'synced' where entity_id = job_outbox;
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  update public.jobs set deleted_at = now() where id = job_outbox;
  if not exists (
    select 1 from public.sync_outbox
    where entity_id = job_outbox and status = 'pending' and operation = 'upsert'
  ) then
    raise exception 'FAIL(16f): a soft delete did not enqueue an upsert (§14.12)';
  end if;

  -- The client may read its own queue (the "Pending changes" counter, §14.13)
  -- and nothing else. Another organization's queue is invisible.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.sync_outbox where organization_id = org_a) then
    raise exception 'FAIL(16g): organization B can read organization A''s sync queue';
  end if;

  -- 17. Refresh tokens are unreachable from any client role (§14.16).
  -- The table has no policy and no grant, so this is refused at the grant
  -- layer rather than returning an empty set — the distinction that mattered
  -- in 20260804000900.
  begin
    perform 1 from public.google_oauth_tokens limit 1;
    raise exception 'FAIL(17): authenticated can read google_oauth_tokens';
  exception
    when insufficient_privilege then null; -- expected
    when others then
      if sqlerrm like 'FAIL(17)%' then raise; end if;
      raise;
  end;

  -- 18. Estimates (§16) follow the Job Tracker rules: staff-accessible within
  -- the organization, invisible across it, and no way to delete a document
  -- someone may be relying on.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  insert into public.estimates (organization_id, job_id, title, subtotal, tax, total)
  values (org_a, job_a, 'Faucet replacement estimate', 280.00, 23.10, 303.10)
  returning id into estimate_a;

  insert into public.estimate_items (estimate_id, organization_id, description, quantity, unit_price, total)
  values (estimate_a, org_a, 'Labor, 2 hours', 2, 90.00, 180.00);

  -- Organization B sees neither.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.estimates where id = estimate_a) then
    raise exception 'FAIL(18a): organization B can read organization A''s estimate';
  end if;
  if exists (select 1 from public.estimate_items where organization_id = org_a) then
    raise exception 'FAIL(18b): organization B can read organization A''s estimate items';
  end if;

  -- And cannot plant one in A.
  mutation_blocked := false;
  begin
    insert into public.estimates (organization_id, title) values (org_a, 'Planted');
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(18c): cross-tenant estimate insert was accepted';
  end if;

  -- A sent estimate cannot be deleted: it is the document a disagreement turns
  -- on. Removal is a status (§16.8), not a DELETE.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  begin
    delete from public.estimates where id = estimate_a;
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from public.estimates where id = estimate_a) then
    raise exception 'FAIL(18d): an estimate was deletable';
  end if;

  -- A line item, by contrast, is ordinary editing of a draft.
  delete from public.estimate_items where estimate_id = estimate_a;
  if exists (select 1 from public.estimate_items where estimate_id = estimate_a) then
    raise exception 'FAIL(18e): an estimate line could not be removed';
  end if;

  -- 18f. The tax rate is a fraction. `8.25` entered where `0.0825` was meant
  -- multiplies the invoice by a hundred, so the column refuses it rather than
  -- relying on the form having validated first.
  mutation_blocked := false;
  begin
    update public.estimates set tax_rate = 8.25 where id = estimate_a;
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(18f): a tax rate of 825%% was accepted';
  end if;

  update public.estimates set tax_rate = 0.0825 where id = estimate_a;
  if not exists (select 1 from public.estimates where id = estimate_a and tax_rate = 0.0825) then
    raise exception 'FAIL(18g): a real tax rate was rejected';
  end if;

  -- 18h. A status the customer can see requires a link they can open. Without
  -- this an estimate could be marked sent with no token, and "sent" would name
  -- something that never reached anyone.
  mutation_blocked := false;
  begin
    update public.estimates set status = 'sent' where id = estimate_a;
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(18h): an estimate was marked sent with no public token';
  end if;

  -- 18i. And "accepted" has to have a date on it — §16.11 writes the amount to
  -- the job on the strength of that word.
  mutation_blocked := false;
  begin
    update public.estimates
      set status = 'accepted', public_token = 'test-token-18i'
      where id = estimate_a;
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(18i): an estimate was accepted with no accepted_at';
  end if;

  -- 18j. The customer-facing link is served by code, never by the Data API.
  --
  -- The public page checks the token server-side with the service role, and the
  -- reason that is not merely a preference is here: `anon` must not be able to
  -- ask PostgREST for an estimate by token — or by anything else. A row filter
  -- "where public_token = ..." would have been the obvious design and would
  -- have let anyone probe the table with a `where` clause of their choosing.
  -- 19. The delivery log (§16.9, foundation for §17.10).
  --
  -- Readable by the organization it belongs to and by nobody else, and not
  -- writable from a browser at all: a delivery record the client could write
  -- is a delivery record that proves nothing.
  perform pg_temp.act_as_postgres();
  insert into public.outbound_emails
    (organization_id, kind, to_email, subject, locale, status, provider_message_id, sent_at)
  values (org_a, 'estimate.sent', 'customer@example.test', 'Your estimate', 'en', 'sent', 'stub-1', now());

  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  if not exists (select 1 from public.outbound_emails where organization_id = org_a) then
    raise exception 'FAIL(19a): the organization cannot read its own delivery log';
  end if;

  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.outbound_emails where organization_id = org_a) then
    raise exception 'FAIL(19b): organization B can read organization A''s delivery log';
  end if;

  -- No insert policy and no insert grant: this is written by server code only.
  mutation_blocked := false;
  begin
    insert into public.outbound_emails (organization_id, kind, to_email, subject)
    values (org_b, 'estimate.sent', 'planted@example.test', 'Planted');
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(19c): a client could write its own delivery record';
  end if;

  -- 19d. "sent" has to mean something: an id and a time, or it is not sent.
  perform pg_temp.act_as_postgres();
  mutation_blocked := false;
  begin
    insert into public.outbound_emails (organization_id, kind, to_email, subject, status)
    values (org_a, 'estimate.sent', 'x@example.test', 'No id', 'sent');
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(19d): a message was recorded as sent with no provider id';
  end if;

  -- 20. Business Website (§19).
  --
  -- Read by the whole organization, written only by its owner: this is the copy
  -- the public reads under the owner's own name, at an address that is unique
  -- across the platform.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  insert into public.business_sites (organization_id, template, color_preset)
  values (org_a, 'classic', 'navy');

  if not exists (select 1 from public.business_sites where organization_id = org_a) then
    raise exception 'FAIL(20a): the owner cannot read their own site';
  end if;

  -- 20b. Staff see it — they answer the phone the page produces — but cannot
  -- change what the business says about itself.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
  if not exists (select 1 from public.business_sites where organization_id = org_a) then
    raise exception 'FAIL(20b): staff member cannot read their organization''s site';
  end if;

  update public.business_sites set template = 'bold' where organization_id = org_a;
  if exists (
    select 1 from public.business_sites where organization_id = org_a and template = 'bold'
  ) then
    raise exception 'FAIL(20c): a staff member changed the website''s template';
  end if;

  -- 20d. Another tenant sees nothing and can plant nothing.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
  if exists (select 1 from public.business_sites where organization_id = org_a) then
    raise exception 'FAIL(20d): organization B can read organization A''s site';
  end if;

  mutation_blocked := false;
  begin
    insert into public.business_sites (organization_id) values (org_a);
  exception when others then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(20e): organization B created a site for organization A';
  end if;

  -- 20f. §19.9: the look is a closed set, not a free-text field that becomes
  -- bespoke design one customer at a time.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  mutation_blocked := false;
  begin
    update public.business_sites set template = 'bespoke' where organization_id = org_a;
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(20f): an unapproved template was accepted';
  end if;

  -- 20g. A block that cannot be switched off must not be recordable as hidden.
  -- The gallery is the one that matters: storing it as hidden today would leave
  -- every site switched off on the day photo upload ships.
  mutation_blocked := false;
  begin
    update public.business_sites
      set hidden_blocks = array['gallery']
      where organization_id = org_a;
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(20g): the gallery was recorded as a hidden block';
  end if;

  -- Switching off a block that *is* optional is ordinary editing.
  update public.business_sites
    set hidden_blocks = array['faq', 'reviews']
    where organization_id = org_a;
  if not exists (
    select 1 from public.business_sites
    where organization_id = org_a and hidden_blocks @> array['faq']
  ) then
    raise exception 'FAIL(20h): the owner could not switch a block off';
  end if;

  -- 20i. Content is per language, and only the two the platform has.
  insert into public.business_site_texts (organization_id, locale, headline)
  values (org_a, 'en', 'Licensed plumbing, same-day service');

  mutation_blocked := false;
  begin
    insert into public.business_site_texts (organization_id, locale) values (org_a, 'fr');
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(20i): content was accepted for a language the platform does not have';
  end if;

  -- 20j. The list columns are lists. A malformed write here would break the
  -- rendered page for every visitor, not only for whoever made it.
  mutation_blocked := false;
  begin
    update public.business_site_texts
      set faq = '{"question": "orphan"}'::jsonb
      where organization_id = org_a and locale = 'en';
  exception when check_violation then
    mutation_blocked := true;
  end;
  if not mutation_blocked then
    raise exception 'FAIL(20j): a non-array was accepted as the FAQ';
  end if;

  -- 20k. Staff can read the text and cannot rewrite it.
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
  if not exists (
    select 1 from public.business_site_texts where organization_id = org_a and locale = 'en'
  ) then
    raise exception 'FAIL(20k): staff member cannot read the site text';
  end if;

  update public.business_site_texts
    set headline = 'Rewritten by staff'
    where organization_id = org_a and locale = 'en';
  if exists (
    select 1 from public.business_site_texts
    where organization_id = org_a and headline = 'Rewritten by staff'
  ) then
    raise exception 'FAIL(20l): a staff member rewrote the website''s headline';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.outbound_emails limit 1;
    raise exception 'FAIL(19e): anon can read the delivery log';
  exception
    when insufficient_privilege then null; -- expected
    when others then
      if sqlerrm like 'FAIL(19e)%' then raise; end if;
      raise;
  end;

  begin
    perform 1 from public.estimates where public_token is not null limit 1;
    raise exception 'FAIL(18j): anon can read estimates by token';
  exception
    when insufficient_privilege then null; -- expected: refused at the grant layer
    when others then
      if sqlerrm like 'FAIL(18j)%' then raise; end if;
      raise;
  end;

  begin
    perform 1 from public.estimate_items limit 1;
    raise exception 'FAIL(18k): anon can read estimate items';
  exception
    when insufficient_privilege then null; -- expected
    when others then
      if sqlerrm like 'FAIL(18k)%' then raise; end if;
      raise;
  end;

  -- 20m. The site's content is destined to be public, and is still not
  -- readable through the Data API: §19.10 requires that a private draft is not
  -- publicly available, and an anon grant would hand every unpublished draft on
  -- the platform to anyone who asks PostgREST for one. The published page is
  -- rendered by server code, which knows what has been published.
  begin
    perform 1 from public.business_sites limit 1;
    raise exception 'FAIL(20m): anon can read business sites';
  exception
    when insufficient_privilege then null; -- expected: refused at the grant layer
    when others then
      if sqlerrm like 'FAIL(20m)%' then raise; end if;
      raise;
  end;

  begin
    perform 1 from public.business_site_texts limit 1;
    raise exception 'FAIL(20n): anon can read unpublished site content';
  exception
    when insufficient_privilege then null; -- expected
    when others then
      if sqlerrm like 'FAIL(20n)%' then raise; end if;
      raise;
  end;

  perform pg_temp.act_as_postgres();
  raise notice 'RLS isolation tests passed';
end;
$$;

rollback;
