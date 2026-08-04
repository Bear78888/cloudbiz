-- Explicit Data API grants.
--
-- Until now the schema relied on Supabase auto-exposing new tables in `public`
-- to the API roles. That behaviour is legacy: the current cloud default is to
-- NOT expose new entities, and the switch that restores the old behaviour is
-- deprecated and removed on 2026-10-30. A schema that only works on projects
-- created before a platform default changed is not a schema — it is a
-- coincidence. Found by the end-to-end suite against a fresh local stack,
-- where every query failed with "permission denied for table
-- organization_members".
--
-- Grants are the coarse gate; RLS (enabled AND forced on every table) is what
-- filters rows. So the rule here is narrow on purpose:
--   * `anon` gets nothing — every policy in this schema is `to authenticated`;
--   * `authenticated` gets exactly the verbs that have a matching policy —
--     notably no DELETE anywhere, because removal is `deleted_at` (§14.12);
--   * `service_role` gets full access; it bypasses RLS by design and is only
--     reachable from trusted server code (§26.1).

begin;

grant usage on schema public to anon, authenticated, service_role;

-- Service role: webhooks, admin and background work (§26.1 trust level 3).
grant select, insert, update, delete on all tables in schema public to service_role;

-- Own profile (§9.3).
grant select, update on public.profiles to authenticated;

-- Admin roles: readable only through the self-select policy.
grant select on public.admin_roles to authenticated;

-- Organizations: members read, owners update; creation is the RPC only.
grant select, update on public.organizations to authenticated;

-- Memberships: owners manage their team, hence the full verb set here.
grant select, insert, update, delete on public.organization_members to authenticated;

grant select, update on public.business_profiles to authenticated;

-- Billing is read-only from the client; writes arrive from Stripe webhooks.
grant select on public.subscriptions to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.usage_events to authenticated;

-- Job Tracker (§13). No DELETE: removal is `deleted_at` (§14.12).
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.jobs to authenticated;

-- Activity trail is append-only and written by triggers (§13.11): read only.
grant select on public.job_activities to authenticated;

-- Audit log: owners read their organization's entries; inserts are server-side.
grant select on public.audit_logs to authenticated;

-- Notifications: recipients read and mark as read (§28.3).
grant select, update on public.notifications to authenticated;

-- public.webhook_events is deliberately absent: service role only (§26.4).

commit;
