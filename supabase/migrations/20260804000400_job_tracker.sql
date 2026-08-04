-- HandyAlliance Job Tracker (Stage 2, spec §13, §25.2, RLS §26.1).
--
-- Conventions follow 20260804000100_platform_foundation.sql: status registries
-- as CHECK constraints (not enums, so later stages extend them with a plain
-- migration), jsonb_typeof guards, forced RLS on every table, security-definer
-- helpers with pinned search_path, append-only history.
--
-- Deliberate FK choices:
--   * customers/jobs cascade from organizations (operational data dies with the
--     tenant);
--   * job_activities carries NO foreign keys at all. It is history: it keeps the
--     original organization_id/job_id even after the referenced rows are gone,
--     and an ON DELETE CASCADE/SET NULL would collide with its immutability
--     trigger and block organization deletion outright — the regression fixed in
--     20260804000300_audit_logs_drop_org_fk.sql.

begin;

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Customers (§25.2). Consent fields are part of the schema from day one
-- (§17.9) so the Reviews & Follow-Ups tool never has to backfill them.
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone text,
  email extensions.citext,
  preferred_locale text not null default 'en',
  address text,
  lead_source text,
  sms_consent boolean not null default false,
  sms_consent_source text,
  sms_consent_at timestamptz,
  sms_opted_out_at timestamptz,
  email_marketing_consent boolean not null default false,
  email_unsubscribed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customers_name_not_blank check (length(trim(name)) > 0),
  constraint customers_locale_check check (preferred_locale in ('en', 'es')),
  constraint customers_lead_source_check check (
    lead_source is null or lead_source in (
      'phone_call', 'website', 'thumbtack', 'yelp', 'google', 'referral', 'other'
    )
  ),
  constraint customers_sms_consent_source_check check (
    sms_consent_source is null or sms_consent_source in (
      'customer_form', 'owner_entry', 'import', 'phone_call', 'website_lead'
    )
  ),
  -- §17.9: a consent snapshot is worthless without its origin and timestamp.
  constraint customers_sms_consent_snapshot_check check (
    not sms_consent or (sms_consent_at is not null and sms_consent_source is not null)
  )
);

create index customers_org_idx on public.customers (organization_id, created_at desc);
create index customers_org_phone_idx on public.customers (organization_id, phone) where phone is not null;
create index customers_org_email_idx on public.customers (organization_id, email) where email is not null;
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Jobs (§25.2, fields §13.5). Deletion is always soft (§14.12).
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null,
  service text,
  description text,
  status text not null default 'new_lead',
  priority text not null default 'normal',
  source text,
  address text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  estimate_amount numeric(12, 2),
  job_total numeric(12, 2),
  materials_cost numeric(12, 2),
  payment_status text not null default 'unpaid',
  assigned_user_id uuid references public.profiles (id) on delete set null,
  -- §13.5 columns the paid tools fill in later (§16, §17); kept here so the
  -- tracker row stays the single view of a job.
  last_follow_up_at timestamptz,
  review_requested_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint jobs_title_not_blank check (length(trim(title)) > 0),
  -- §13.6 technical status registry. Display strings are localized in the UI.
  constraint jobs_status_check check (
    status in (
      'new_lead', 'contacted', 'estimate_draft', 'estimate_sent', 'estimate_accepted',
      'scheduled', 'in_progress', 'completed', 'paid', 'lost', 'canceled'
    )
  ),
  constraint jobs_priority_check check (priority in ('normal', 'urgent')),
  constraint jobs_payment_status_check check (
    payment_status in ('unpaid', 'partial', 'paid', 'refunded')
  ),
  constraint jobs_source_check check (
    source is null or source in (
      'phone_call', 'website', 'thumbtack', 'yelp', 'google', 'referral', 'other'
    )
  ),
  constraint jobs_schedule_order_check check (
    scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start
  ),
  constraint jobs_estimate_amount_check check (estimate_amount is null or estimate_amount >= 0),
  constraint jobs_job_total_check check (job_total is null or job_total >= 0),
  constraint jobs_materials_cost_check check (materials_cost is null or materials_cost >= 0)
);

create index jobs_org_status_idx on public.jobs (organization_id, status, created_at desc)
  where deleted_at is null;
create index jobs_org_created_idx on public.jobs (organization_id, created_at desc);
create index jobs_org_scheduled_idx on public.jobs (organization_id, scheduled_start)
  where deleted_at is null;
create index jobs_org_payment_idx on public.jobs (organization_id, payment_status)
  where deleted_at is null;
create index jobs_customer_idx on public.jobs (customer_id) where customer_id is not null;
create index jobs_assigned_idx on public.jobs (assigned_user_id) where assigned_user_id is not null;
create index jobs_title_trgm_idx on public.jobs using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Job activities (§25.2, §13.11): append-only trail of every change.
-- No foreign keys — see the header note.
-- ---------------------------------------------------------------------------

create table public.job_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid,
  customer_id uuid,
  event_type text not null,
  actor_type text not null default 'user',
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_activities_event_type_check check (
    event_type in (
      'job.created', 'job.updated', 'job.status_changed', 'job.assigned',
      'job.deleted', 'job.restored', 'job.imported',
      'customer.created', 'customer.updated', 'customer.deleted', 'customer.imported'
    )
  ),
  constraint job_activities_actor_type_check check (
    actor_type in ('user', 'admin', 'system', 'webhook')
  ),
  constraint job_activities_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint job_activities_subject_check check (job_id is not null or customer_id is not null)
);

create index job_activities_job_idx on public.job_activities (job_id, created_at desc)
  where job_id is not null;
create index job_activities_org_idx on public.job_activities (organization_id, created_at desc);
create index job_activities_customer_idx on public.job_activities (customer_id, created_at desc)
  where customer_id is not null;

create or replace function app_private.job_activities_block_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'job_activities are append-only';
end;
$$;

create trigger job_activities_immutable
  before update or delete on public.job_activities
  for each row execute function app_private.job_activities_block_mutation();

-- ---------------------------------------------------------------------------
-- Activity recording (§13.11): triggers, not application code, so every write
-- path — UI, CSV import, future paid tools, service role — produces a trail.
--
-- SECURITY DEFINER (owner: postgres) is what lets these insert into the
-- append-only, force-RLS table that has no INSERT policy: the client can read
-- its own history but can never forge an entry.
-- ---------------------------------------------------------------------------

create or replace function app_private.current_actor_type()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then 'system' else 'user' end;
$$;

/*
 * Batch writes (CSV import, §14.15) announce themselves by setting the
 * transaction-local GUC `handyalliance.activity_context` to 'import' inside the
 * importing RPC, so the trail says "imported" instead of a hundred "created"
 * entries. Absent or unrecognised → ordinary create/update events.
 */
create or replace function app_private.activity_context()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(current_setting('handyalliance.activity_context', true), ''), 'default');
$$;

revoke all on function app_private.current_actor_type() from public;
revoke all on function app_private.activity_context() from public;

create or replace function app_private.record_job_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  resolved_event text;
  changed text[] := array[]::text[];
  details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    resolved_event := case
      when app_private.activity_context() = 'import' then 'job.imported'
      else 'job.created'
    end;
    details := jsonb_build_object('status', new.status);
  else
    -- Soft delete and restore are their own events (§14.12).
    if old.deleted_at is null and new.deleted_at is not null then
      resolved_event := 'job.deleted';
    elsif old.deleted_at is not null and new.deleted_at is null then
      resolved_event := 'job.restored';
    elsif old.status is distinct from new.status then
      resolved_event := 'job.status_changed';
      details := jsonb_build_object('from', old.status, 'to', new.status);
    elsif old.assigned_user_id is distinct from new.assigned_user_id then
      resolved_event := 'job.assigned';
      details := jsonb_build_object('to', new.assigned_user_id);
    else
      resolved_event := 'job.updated';
    end if;

    if resolved_event = 'job.updated' then
      -- Field names only: the activity feed logs what changed, never the
      -- customer data itself (§26.6 logs actions, not payloads).
      if old.title is distinct from new.title then changed := changed || 'title'; end if;
      if old.service is distinct from new.service then changed := changed || 'service'; end if;
      if old.description is distinct from new.description then changed := changed || 'description'; end if;
      if old.priority is distinct from new.priority then changed := changed || 'priority'; end if;
      if old.address is distinct from new.address then changed := changed || 'address'; end if;
      if old.scheduled_start is distinct from new.scheduled_start then changed := changed || 'scheduled_start'; end if;
      if old.scheduled_end is distinct from new.scheduled_end then changed := changed || 'scheduled_end'; end if;
      if old.estimate_amount is distinct from new.estimate_amount then changed := changed || 'estimate_amount'; end if;
      if old.job_total is distinct from new.job_total then changed := changed || 'job_total'; end if;
      if old.materials_cost is distinct from new.materials_cost then changed := changed || 'materials_cost'; end if;
      if old.payment_status is distinct from new.payment_status then changed := changed || 'payment_status'; end if;
      if old.customer_id is distinct from new.customer_id then changed := changed || 'customer'; end if;
      if old.notes is distinct from new.notes then changed := changed || 'notes'; end if;
      if old.source is distinct from new.source then changed := changed || 'source'; end if;

      -- Nothing meaningful changed (e.g. a no-op save): skip the entry.
      if array_length(changed, 1) is null then
        return new;
      end if;
      details := jsonb_build_object('fields', to_jsonb(changed));
    end if;
  end if;

  insert into public.job_activities (
    organization_id, job_id, customer_id, event_type, actor_type, actor_id, metadata
  )
  values (
    new.organization_id, new.id, new.customer_id, resolved_event,
    app_private.current_actor_type(), auth.uid(), details
  );

  return new;
end;
$$;

create or replace function app_private.record_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  resolved_event text;
  changed text[] := array[]::text[];
  details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    resolved_event := case
      when app_private.activity_context() = 'import' then 'customer.imported'
      else 'customer.created'
    end;
  elsif old.deleted_at is null and new.deleted_at is not null then
    resolved_event := 'customer.deleted';
  else
    resolved_event := 'customer.updated';
    if old.name is distinct from new.name then changed := changed || 'name'; end if;
    if old.phone is distinct from new.phone then changed := changed || 'phone'; end if;
    if old.email is distinct from new.email then changed := changed || 'email'; end if;
    if old.address is distinct from new.address then changed := changed || 'address'; end if;
    if old.preferred_locale is distinct from new.preferred_locale then changed := changed || 'preferred_locale'; end if;
    if old.lead_source is distinct from new.lead_source then changed := changed || 'lead_source'; end if;
    if old.notes is distinct from new.notes then changed := changed || 'notes'; end if;
    if old.sms_consent is distinct from new.sms_consent then changed := changed || 'sms_consent'; end if;
    if old.email_marketing_consent is distinct from new.email_marketing_consent then
      changed := changed || 'email_marketing_consent';
    end if;
    if old.deleted_at is distinct from new.deleted_at then changed := changed || 'deleted_at'; end if;

    if array_length(changed, 1) is null then
      return new;
    end if;
    details := jsonb_build_object('fields', to_jsonb(changed));
  end if;

  insert into public.job_activities (
    organization_id, customer_id, event_type, actor_type, actor_id, metadata
  )
  values (
    new.organization_id, new.id, resolved_event,
    app_private.current_actor_type(), auth.uid(), details
  );

  return new;
end;
$$;

create trigger jobs_record_activity
  after insert or update on public.jobs
  for each row execute function app_private.record_job_activity();

create trigger customers_record_activity
  after insert or update on public.customers
  for each row execute function app_private.record_customer_activity();

-- updated_at triggers (same registry pattern as the foundation migration).
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['customers', 'jobs']
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function app_private.set_updated_at()',
      relation_name || '_set_updated_at',
      relation_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (§26.1). Job Tracker is staff-accessible work (§11.3):
-- every active member reads and writes their organization's customers and
-- jobs. Nobody gets a DELETE policy — removal is `deleted_at` (§14.12).
-- ---------------------------------------------------------------------------

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['customers', 'jobs', 'job_activities']
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('alter table public.%I force row level security', relation_name);
  end loop;
end;
$$;

create policy customers_member_select
  on public.customers for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy customers_member_insert
  on public.customers for insert to authenticated
  with check (app_private.is_member_of(organization_id));

create policy customers_member_update
  on public.customers for update to authenticated
  using (app_private.is_member_of(organization_id))
  with check (app_private.is_member_of(organization_id));

create policy jobs_member_select
  on public.jobs for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy jobs_member_insert
  on public.jobs for insert to authenticated
  with check (app_private.is_member_of(organization_id));

create policy jobs_member_update
  on public.jobs for update to authenticated
  using (app_private.is_member_of(organization_id))
  with check (app_private.is_member_of(organization_id));

-- Read-only from the client: entries are written by the SECURITY DEFINER
-- triggers above, so the trail cannot be forged or edited.
create policy job_activities_member_select
  on public.job_activities for select to authenticated
  using (app_private.is_member_of(organization_id));

commit;
