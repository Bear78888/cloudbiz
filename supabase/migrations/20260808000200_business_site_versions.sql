-- Business Website: published versions and rollback (§19.10).
--
-- Until now publishing was a status. That is enough to put a page on the
-- internet and not enough to satisfy §19.10's last line: "a published version
-- rolls back to the previous one". There has to *be* a previous one.
--
-- Three decisions worth reading before the DDL.
--
-- 1. A version is a snapshot of the whole site, not a diff and not a pointer at
--    the live rows. The point of publishing is that what the public reads stops
--    changing when the owner edits: with live rows, half-finished wording is on
--    the internet the moment it is typed, and "roll back" would have nothing to
--    roll back to. So the snapshot carries the settings, the profile facts the
--    page renders, and every language's content, in one jsonb.
--
-- 2. Append-only, and enforced rather than described. No update policy, no
--    delete policy, no grants for either, and a trigger on top — the same
--    treatment `audit_logs` gets. Rolling back moves a pointer; it never edits
--    or removes a version, because the version someone rolled *away from* is
--    exactly the thing they may want back ten minutes later.
--
-- 3. The FK to organizations cascades, unlike `audit_logs` and
--    `job_activities`. Those are evidence: "we emailed this address on this
--    date" stays true after the organization is gone. A site version is
--    content — what a business's own homepage said — and when the business is
--    deleted there is no one it is true *about*. Keeping it would be data
--    retention nobody asked for (§32).

begin;

create table public.business_site_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Per organization, computed from what exists rather than passed in: two
  -- publishes at once must not both claim version 4, and the unique index would
  -- reject the second.
  version integer not null,
  snapshot jsonb not null,
  -- The person who pressed Publish. A plain uuid with no foreign key: they may
  -- leave the organization or be deleted, and "who published this" is still a
  -- fact about the past.
  published_by uuid,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint business_site_versions_version_check check (version > 0),
  constraint business_site_versions_snapshot_is_object check (jsonb_typeof(snapshot) = 'object'),
  constraint business_site_versions_unique_version unique (organization_id, version)
);

create index business_site_versions_organization_idx
  on public.business_site_versions (organization_id, version desc);

-- Which version is live. Deliberately not `on delete cascade` and not
-- `set null`: a version that is currently published must not be removable, and
-- nothing removes versions anyway. `restrict` says so out loud.
alter table public.business_sites
  add column published_version_id uuid references public.business_site_versions (id) on delete restrict;

-- A published site points at the version the public is reading. Without this
-- `status = 'published'` could mean "live" with nothing to serve, which is the
-- state the renderer cannot do anything sensible with.
alter table public.business_sites
  add constraint business_sites_published_has_version check (
    status <> 'published' or published_version_id is not null
  );

-- ---------------------------------------------------------------------------
-- Append-only, enforced (see note 2).
-- ---------------------------------------------------------------------------

create or replace function app_private.business_site_versions_block_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'business_site_versions are append-only';
end;
$$;

revoke all on function app_private.business_site_versions_block_mutation() from public;

create trigger business_site_versions_immutable
  before update or delete on public.business_site_versions
  for each row execute function app_private.business_site_versions_block_mutation();

-- ---------------------------------------------------------------------------
-- Row Level Security (§26.1). Same shape as `business_sites`: the organization
-- reads, only the owner writes — publishing is the moment a page goes out under
-- the business's name.
-- ---------------------------------------------------------------------------

alter table public.business_site_versions enable row level security;
alter table public.business_site_versions force row level security;

create policy business_site_versions_member_select
  on public.business_site_versions for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy business_site_versions_owner_insert
  on public.business_site_versions for insert to authenticated
  with check (app_private.is_org_owner(organization_id));

-- ---------------------------------------------------------------------------
-- Data API grants. No update, no delete — for anyone but the service role,
-- which needs them for nothing here and is refused by the trigger regardless.
-- `anon` gets nothing: the public page is rendered by server code that reads
-- the published snapshot (§19.10).
-- ---------------------------------------------------------------------------

grant select, insert on public.business_site_versions to service_role;
grant select, insert on public.business_site_versions to authenticated;

commit;
