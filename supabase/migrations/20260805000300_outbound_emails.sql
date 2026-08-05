-- Outbound email (§16.9 now; §17.10 and §28 later).
--
-- Two things, both small on purpose.
--
-- 1. `job_activities` learns the estimate events. §16.11 wants sending an
--    estimate to show up in the job's history, and the registry is a CHECK, so
--    a new event type is a migration rather than a hopeful insert.
--
-- 2. `outbound_emails` records that a message was sent, and carries the
--    provider's id for it.
--
-- The second is the part worth explaining, because delivery tracking is
-- deliberately NOT being built yet. §17.10 will need a delivery status per
-- message, and Resend reports delivery by webhook — referencing the message by
-- the id it returned at send time. Without a row holding that id there is
-- nothing for a webhook to update, and adding one later would mean rewriting
-- every place that sends. So the row exists now and its status column stays at
-- `sent`; the webhook that advances it is a later change that touches this
-- table and nothing else.
--
-- Ids here are plain uuids with no foreign keys, exactly like `job_activities`
-- (see 20260804000300): this is a record of something that happened. If an
-- estimate or an organization is deleted, "we emailed this address on this
-- date" is still true, and a cascade would erase the evidence — which is the
-- opposite of what a delivery log is for.

begin;

-- ---------------------------------------------------------------------------
-- Estimate events in the job's history (§16.11).
-- ---------------------------------------------------------------------------

alter table public.job_activities
  drop constraint job_activities_event_type_check;

alter table public.job_activities
  add constraint job_activities_event_type_check check (
    event_type in (
      'job.created', 'job.updated', 'job.status_changed', 'job.assigned',
      'job.deleted', 'job.restored', 'job.imported',
      'customer.created', 'customer.updated', 'customer.deleted', 'customer.imported',
      'estimate.sent', 'estimate.viewed', 'estimate.accepted', 'estimate.rejected'
    )
  );

-- ---------------------------------------------------------------------------
-- The delivery log.
-- ---------------------------------------------------------------------------

create table public.outbound_emails (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  -- What this message was. A registry, so a new kind of mail is a decision
  -- rather than a free-text string nobody can group by later.
  kind text not null,
  estimate_id uuid,
  job_id uuid,
  customer_id uuid,
  to_email text not null,
  subject text not null,
  locale text not null default 'en',
  provider text not null default 'resend',
  -- Null until the provider accepts it; unique because a webhook will look a
  -- message up by exactly this and must not find two.
  provider_message_id text unique,
  status text not null default 'queued',
  -- The provider's complaint, for the owner to read. Never the message body.
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_emails_kind_check check (
    kind in ('estimate.sent', 'estimate.reminder', 'review.request', 'owner.notification')
  ),
  -- §17.10's vocabulary, declared now so the webhook has somewhere to land.
  constraint outbound_emails_status_check check (
    status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')
  ),
  constraint outbound_emails_to_not_blank check (length(trim(to_email)) > 0),
  constraint outbound_emails_locale_check check (locale in ('en', 'es')),
  -- A message that reached the provider has an id and a time; one that did not
  -- has a reason. Without this, "sent" could mean nothing in particular.
  constraint outbound_emails_sent_snapshot check (
    status = 'queued' or status = 'failed' or (provider_message_id is not null and sent_at is not null)
  ),
  constraint outbound_emails_failed_snapshot check (status <> 'failed' or failed_at is not null)
);

create index outbound_emails_organization_idx
  on public.outbound_emails (organization_id, created_at desc);
create index outbound_emails_estimate_idx
  on public.outbound_emails (estimate_id) where estimate_id is not null;
create index outbound_emails_job_idx
  on public.outbound_emails (job_id) where job_id is not null;

create trigger outbound_emails_set_updated_at
  before update on public.outbound_emails
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. The owner may read what was sent on their behalf; nobody writes from a
-- browser. Sending happens in server code with the service role, and the
-- webhook that will update these rows is server code too.
-- ---------------------------------------------------------------------------

alter table public.outbound_emails enable row level security;
alter table public.outbound_emails force row level security;

create policy outbound_emails_member_select
  on public.outbound_emails for select to authenticated
  using (app_private.is_member_of(organization_id));

grant select, insert, update, delete on public.outbound_emails to service_role;
-- Read only, and only what a policy backs: a delivery log the client could
-- write would be a delivery log that proves nothing.
grant select on public.outbound_emails to authenticated;

commit;
