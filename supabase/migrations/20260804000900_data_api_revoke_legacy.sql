-- Revoke the legacy blanket Data API grants.
--
-- 20260804000800 granted narrowly on the assumption that nothing was granted
-- yet. That is true for a project created today. It is false for this one:
-- applying 800 to the live database changed nothing, because the project was
-- created while Supabase still auto-exposed everything, and its default ACL
-- reads
--
--     anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres
--
-- on tables — insert, select, update, delete, TRUNCATE, references, trigger,
-- maintain, on every table that exists and every table a future migration will
-- create. Granting a subset on top of a superset is a no-op, so the narrow
-- matrix in 800 was documentation, not enforcement. Adding privileges is not
-- the same operation as making the privilege set correct; this migration does
-- the second one.
--
-- Why it matters even though RLS is enabled and forced everywhere:
--
--   * TRUNCATE is not filtered by RLS at all. No policy can stop it. It is not
--     reachable through PostgREST today, which is a property of the API layer
--     in front of the grant — not a property of the grant.
--   * `webhook_events` is service-role-only by design (§26.4) and carries no
--     policies at all. Forced RLS with no policy denies rows, so the exposure
--     was latent rather than live — but "no policy" is a weaker guarantee to
--     rest on than "no grant", and a policy added later for some other purpose
--     would silently turn it into access.
--   * Defence in depth (§26) means the grant layer and the row layer fail
--     independently. Two layers that were only ever one layer are one layer.
--
-- The end state is identical for a fresh database and for this one: revoke
-- everything from the two API roles, drop the default that keeps handing it
-- back, then re-apply exactly the matrix in 800 — the verbs that have a
-- matching policy, and nothing else. `service_role` is untouched: it bypasses
-- RLS by design and is reachable only from trusted server code (§26.1).

begin;

-- 1. Stop future tables from inheriting the blanket grant.
--
-- Default ACLs are per-creating-role, so the entry that matters is the one for
-- the role our migrations run as (postgres). `supabase_admin` owns some
-- platform-created objects and has an identical entry; altering it requires
-- membership in that role, which the migration runner may not have, and it
-- does not exist at all on the plain Postgres used by CI. Neither case is a
-- reason to fail the migration, so it is attempted and reported.
do $$
declare
  target text;
begin
  foreach target in array array['postgres', 'supabase_admin'] loop
    if not exists (select 1 from pg_roles where rolname = target) then
      continue;
    end if;
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated',
        target
      );
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated',
        target
      );
    exception
      when insufficient_privilege then
        raise notice
          'default privileges for role % left unchanged (no membership); tables created by that role keep the legacy grant',
          target;
    end;
  end loop;
end;
$$;

-- 2. Clear what the legacy default already handed out.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 3. Re-apply the intended matrix (identical to 20260804000800).
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;

-- `anon` is absent from every line below on purpose: every policy in this
-- schema is `to authenticated`, so an anon grant could only ever return zero
-- rows or an error. The API surface should say that, not discover it.

grant select, update on public.profiles to authenticated;
grant select on public.admin_roles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, update on public.business_profiles to authenticated;

grant select on public.subscriptions to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.usage_events to authenticated;

-- Job Tracker (§13). No DELETE: removal is `deleted_at` (§14.12).
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.jobs to authenticated;

-- Append-only trail written by SECURITY DEFINER helpers (§13.11): read only.
grant select on public.job_activities to authenticated;

grant select on public.audit_logs to authenticated;
grant select, update on public.notifications to authenticated;

-- public.webhook_events stays absent: service role only (§26.4).

commit;
