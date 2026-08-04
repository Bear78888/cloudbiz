-- Google Sheets Sync (Stage 3, spec §14, §25.8, RLS §26.1).
--
-- Conventions follow 20260804000400_job_tracker.sql: status registries as CHECK
-- constraints, jsonb_typeof guards, RLS enabled AND forced on every table,
-- SECURITY DEFINER writers with pinned search_path, explicit Data API grants.
--
-- Grants are explicit and mandatory now: since 20260804000900 nothing in
-- `public` is exposed by default, and check 15c of the RLS suite fails a policy
-- that has no grant behind it. A new table that forgets its grant no longer
-- reaches a browser to be discovered there.
--
-- Two decisions worth reading before the DDL.
--
-- 1. The refresh token lives in its own table, not in a column of
--    `google_connections`. §14.16 requires that tokens are not reachable from
--    the frontend. If the ciphertext sat next to `email` and `status` — the
--    fields the settings screen must render — then "not reachable" would rest
--    on every future `select` remembering to list columns instead of `*`. One
--    `select *` written in a hurry would ship refresh tokens to the browser.
--    Splitting the table makes the safe thing structural: `google_oauth_tokens`
--    has no grant for any client role at all, like `webhook_events` (§26.4), so
--    there is no query the browser can write that returns it. Encryption is
--    still applied on top (the key lives in env, never in the database, so a
--    database dump alone is not enough) — but the table boundary is what makes
--    a leak impossible rather than unlikely.
--
-- 2. `sync_outbox` cascades from `organizations`, unlike `job_activities`.
--    The rule from 20260804000300 is about *history*: audit and activity tables
--    keep the original ids after the referenced rows are gone, so an FK there
--    would either destroy history or block the delete outright. The outbox is
--    not history — it is a work queue, and work for a deleted organization must
--    not outlive it. Rows here are meant to be drained and pruned.

begin;

-- ---------------------------------------------------------------------------
-- Connection metadata (§25.8). Safe to render: no secrets in this table.
-- ---------------------------------------------------------------------------

create table public.google_connections (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Google's stable user id (`sub`). Email changes, `sub` does not, so
  -- reconnect can tell "same account" from "a different one" (§14.5).
  google_subject text not null,
  email extensions.citext,
  scopes text[] not null default array[]::text[],
  status text not null default 'active',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_connections_subject_not_blank check (length(trim(google_subject)) > 0),
  constraint google_connections_status_check check (
    status in ('active', 'needs_reconnect', 'revoked')
  ),
  -- A revoked connection without a timestamp is a connection nobody can reason
  -- about later.
  constraint google_connections_revoked_snapshot_check check (
    status <> 'revoked' or revoked_at is not null
  )
);

-- §14.5: one active Google connection per organization. A partial unique index
-- rather than application logic, so a double-click on "Connect" cannot produce
-- two live connections racing over the same spreadsheet.
create unique index google_connections_one_active
  on public.google_connections (organization_id)
  where status = 'active';

create index google_connections_organization_idx
  on public.google_connections (organization_id);

-- ---------------------------------------------------------------------------
-- Refresh tokens (§14.4 step 5, §14.16). Server-side only — see note 1 above.
-- ---------------------------------------------------------------------------

create table public.google_oauth_tokens (
  connection_id uuid primary key references public.google_connections (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Ciphertext produced by the application (AES-256-GCM); the key is env-only
  -- and never stored here, so a database dump does not yield tokens.
  encrypted_refresh_token text not null,
  -- Which key encrypted it. Rotation (§33) replaces keys over time, and without
  -- this column the only way to find out which key a row needs is to try them.
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_oauth_tokens_ciphertext_not_blank
    check (length(trim(encrypted_refresh_token)) > 0),
  -- Cheap guard against storing a raw Google refresh token by mistake: they
  -- start with "1//" and contain no colon-delimited GCM envelope.
  constraint google_oauth_tokens_looks_encrypted
    check (encrypted_refresh_token not like '1//%'),
  constraint google_oauth_tokens_key_version_check check (key_version > 0)
);

-- ---------------------------------------------------------------------------
-- The mirrored spreadsheet (§25.8, §14.5: one active per organization).
-- ---------------------------------------------------------------------------

create table public.google_spreadsheets (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid references public.google_connections (id) on delete set null,
  spreadsheet_id text not null,
  spreadsheet_name text not null,
  -- §14.8: the sheet schema is versioned, because column order and names are a
  -- contract with whatever the owner wired into Make/Zapier/n8n.
  schema_version integer not null default 1,
  -- Tab name -> numeric sheetId. §14.8 is explicit that rows and tabs are
  -- addressed by id, not by title: the owner can rename a tab, and a sync that
  -- matched on the title would then write into nothing or into the wrong tab.
  tab_mapping jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  last_full_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_spreadsheets_spreadsheet_id_not_blank
    check (length(trim(spreadsheet_id)) > 0),
  constraint google_spreadsheets_name_not_blank
    check (length(trim(spreadsheet_name)) > 0),
  constraint google_spreadsheets_schema_version_check check (schema_version > 0),
  constraint google_spreadsheets_tab_mapping_is_object
    check (jsonb_typeof(tab_mapping) = 'object'),
  -- §14.14 "unavailable" is a real state, not an error page: the sheet is gone
  -- or unreachable while HandyAlliance data stays intact.
  constraint google_spreadsheets_status_check check (
    status in ('active', 'unavailable', 'replaced', 'disconnected')
  )
);

create unique index google_spreadsheets_one_active
  on public.google_spreadsheets (organization_id)
  where status = 'active';

create index google_spreadsheets_organization_idx
  on public.google_spreadsheets (organization_id);

-- ---------------------------------------------------------------------------
-- Outbox (§14.9). Written in the same transaction as the data change, so the
-- queue cannot disagree with the database it mirrors.
-- ---------------------------------------------------------------------------

create table public.sync_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  payload_version integer not null default 1,
  -- §14.11: idempotency is what keeps a retried batch from writing a row twice.
  idempotency_key text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_outbox_entity_type_check check (
    entity_type in ('job', 'customer')
  ),
  constraint sync_outbox_operation_check check (
    operation in ('upsert', 'delete')
  ),
  -- §14.10 verbatim.
  constraint sync_outbox_status_check check (
    status in ('pending', 'processing', 'synced', 'retrying', 'failed', 'disconnected')
  ),
  constraint sync_outbox_attempts_check check (attempts >= 0),
  constraint sync_outbox_payload_version_check check (payload_version > 0)
);

-- One pending event per entity: §14.11 asks for debounce and batching, and the
-- cheapest debounce is refusing to queue the same row twice. A second change to
-- a job while its first event is still waiting updates that event instead of
-- adding another (see the enqueue function below), so a burst of edits costs
-- one write to the sheet, not one per keystroke.
create unique index sync_outbox_one_open_per_entity
  on public.sync_outbox (organization_id, entity_type, entity_id)
  where status in ('pending', 'retrying');

create unique index sync_outbox_idempotency_key on public.sync_outbox (idempotency_key);

-- The worker's query: what is due, oldest first.
create index sync_outbox_due_idx
  on public.sync_outbox (next_attempt_at)
  where status in ('pending', 'retrying');

create index sync_outbox_organization_idx on public.sync_outbox (organization_id);

-- ---------------------------------------------------------------------------
-- Enqueue. SECURITY DEFINER so the trail is written on every write path and
-- cannot be forged from a client — the same reasoning as
-- app_private.record_job_activity() in 20260804000400.
-- ---------------------------------------------------------------------------

create or replace function app_private.enqueue_sync_event(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.sync_outbox (
    organization_id, entity_type, entity_id, operation, idempotency_key
  )
  values (
    p_organization_id,
    p_entity_type,
    p_entity_id,
    p_operation,
    -- Unique per (entity, operation, attempt-generation). The clock is part of
    -- it so that a row synced now and edited again later gets a fresh key
    -- rather than colliding with its own history.
    p_entity_type || ':' || p_entity_id::text || ':' || p_operation || ':' ||
      extract(epoch from clock_timestamp())::text
  )
  on conflict (organization_id, entity_type, entity_id)
    where status in ('pending', 'retrying')
  do update set
    -- Collapse into the waiting event (debounce, §14.11). A delete supersedes a
    -- pending upsert: syncing the old values of a row that is already gone
    -- would put stale data in the sheet and then remove it a moment later.
    operation = case
      when sync_outbox.operation = 'delete' or excluded.operation = 'delete'
        then 'delete'
      else excluded.operation
    end,
    status = 'pending',
    next_attempt_at = now(),
    updated_at = now();
end;
$$;

revoke execute on function app_private.enqueue_sync_event(uuid, text, uuid, text) from public;

create or replace function app_private.enqueue_entity_sync()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  op text;
begin
  -- §14.12: a soft-deleted row is not removed from the sheet, it is marked
  -- Deleted = TRUE. So both cases are an 'upsert' of the current row state;
  -- 'delete' is reserved for a hard removal, which no user path performs today.
  op := 'upsert';

  -- Skip no-op updates: `updated_at` alone changing is not a reason to spend a
  -- Google API call.
  if tg_op = 'UPDATE' and to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then
    return new;
  end if;

  perform app_private.enqueue_sync_event(
    new.organization_id, tg_argv[0], new.id, op
  );
  return new;
end;
$$;

revoke execute on function app_private.enqueue_entity_sync() from public;

create trigger jobs_enqueue_sync
  after insert or update on public.jobs
  for each row execute function app_private.enqueue_entity_sync('job');

create trigger customers_enqueue_sync
  after insert or update on public.customers
  for each row execute function app_private.enqueue_entity_sync('customer');

-- updated_at triggers (same registry pattern as the earlier migrations).
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'google_connections', 'google_oauth_tokens', 'google_spreadsheets', 'sync_outbox'
  ]
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
-- Row Level Security (§26.1).
-- ---------------------------------------------------------------------------

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'google_connections', 'google_oauth_tokens', 'google_spreadsheets', 'sync_outbox'
  ]
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('alter table public.%I force row level security', relation_name);
  end loop;
end;
$$;

-- Connecting and disconnecting Google is an owner decision, not a staff one:
-- it moves the organization's data to an outside account (§11.3). Staff still
-- read the status, because "why is my job not in the sheet" is their question
-- to answer too.
create policy google_connections_member_select
  on public.google_connections for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy google_spreadsheets_member_select
  on public.google_spreadsheets for select to authenticated
  using (app_private.is_member_of(organization_id));

-- Pending-changes count in the settings screen (§14.13). Read only: rows are
-- written by the trigger above and advanced by the worker under service role.
create policy sync_outbox_member_select
  on public.sync_outbox for select to authenticated
  using (app_private.is_member_of(organization_id));

-- google_oauth_tokens gets no policy and no grant at all: service role only,
-- exactly like webhook_events (§26.4, §14.16).

-- ---------------------------------------------------------------------------
-- Data API grants (mandatory since 20260804000900).
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.google_connections to service_role;
grant select, insert, update, delete on public.google_oauth_tokens to service_role;
grant select, insert, update, delete on public.google_spreadsheets to service_role;
grant select, insert, update, delete on public.sync_outbox to service_role;

grant select on public.google_connections to authenticated;
grant select on public.google_spreadsheets to authenticated;
grant select on public.sync_outbox to authenticated;

-- `anon` gets nothing, and `google_oauth_tokens` gets nothing for any client
-- role. Both are deliberate; check 15 of the RLS suite enforces the first.

commit;
