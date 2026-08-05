-- Estimate & Quote Maker (Stage 4, §16, §25.3).
--
-- Conventions as before: CHECK registries instead of enums, RLS enabled AND
-- forced, explicit Data API grants (nothing is exposed by default since
-- 20260804000900), `updated_at` triggers, no DELETE policies.
--
-- Three decisions worth reading before the DDL.
--
-- 1. The customer-facing link is a token column, and `anon` still gets no
--    grant on these tables. The public page reads the estimate server-side
--    after checking the token, exactly like the rest of the elevated paths
--    (§26.1). Giving `anon` a select policy "filtered by token" would mean the
--    whole table is reachable by anyone who can guess a `where` clause, and
--    PostgREST makes guessing easy. A token is a bearer credential; it belongs
--    in code that can rate-limit and log, not in a row filter.
--
-- 2. Money lives on `estimates` as stored totals, not as a view over the items.
--    §16.5 is emphatic that the owner confirms the final price: what was
--    approved must be what the customer sees, even if an item is edited
--    afterwards. A computed total would silently rewrite an accepted estimate.
--
-- 3. `version` is per job (§25.3). A revised estimate is a new row, not an
--    edit of the sent one — otherwise "the estimate they accepted" stops being
--    a thing that exists, and that is the document a disagreement turns on.

begin;

create table public.estimates (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  version integer not null default 1,
  locale text not null default 'en',
  status text not null default 'draft',
  -- Totals as approved. See note 2.
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  title text not null,
  scope text,
  included_work jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  terms text,
  pdf_path text,
  -- Unguessable and unique. Generated server-side; never derived from the id,
  -- because an id that appears in an internal URL would then hand out access.
  public_token text unique,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimates_title_not_blank check (length(trim(title)) > 0),
  constraint estimates_version_check check (version > 0),
  constraint estimates_locale_check check (locale in ('en', 'es')),
  -- §16.8 verbatim.
  constraint estimates_status_check check (
    status in ('draft', 'ready', 'sent', 'viewed', 'accepted', 'rejected', 'expired')
  ),
  constraint estimates_amounts_check check (subtotal >= 0 and tax >= 0 and total >= 0),
  constraint estimates_included_work_is_array check (jsonb_typeof(included_work) = 'array'),
  constraint estimates_exclusions_is_array check (jsonb_typeof(exclusions) = 'array'),
  -- A sent estimate without a token is a link nobody can open; a token on a
  -- draft is a link that exists before anyone meant to share it.
  constraint estimates_sent_has_token check (
    status in ('draft', 'ready') or public_token is not null
  ),
  -- The timestamps have to agree with the status, or "accepted" becomes a word
  -- rather than a fact with a date attached (§16.11 writes the amount to the
  -- job on the strength of it).
  constraint estimates_accepted_snapshot check (status <> 'accepted' or accepted_at is not null),
  constraint estimates_rejected_snapshot check (status <> 'rejected' or rejected_at is not null)
);

create unique index estimates_job_version on public.estimates (job_id, version)
  where job_id is not null;

create index estimates_organization_idx on public.estimates (organization_id);
create index estimates_job_idx on public.estimates (job_id);

create table public.estimate_items (
  id uuid primary key default extensions.gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  -- Denormalised so RLS can be expressed on the row itself rather than through
  -- a join: a policy that has to look at the parent is a policy that is one
  -- refactor away from being wrong.
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_type text not null default 'labor',
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_items_description_not_blank check (length(trim(description)) > 0),
  constraint estimate_items_type_check check (item_type in ('labor', 'material', 'fee', 'discount')),
  -- A discount is the one line that may be negative; everything else going
  -- below zero is a mistake that would quietly shrink the total.
  constraint estimate_items_amounts_check check (
    quantity >= 0
    and (item_type = 'discount' or (unit_price >= 0 and total >= 0))
  )
);

create index estimate_items_estimate_idx on public.estimate_items (estimate_id, sort_order);
create index estimate_items_organization_idx on public.estimate_items (organization_id);

-- updated_at triggers (same registry pattern as the earlier migrations).
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['estimates', 'estimate_items']
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
  foreach relation_name in array array['estimates', 'estimate_items']
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('alter table public.%I force row level security', relation_name);
  end loop;
end;
$$;

-- Estimates are staff-accessible work like jobs (§11.3): whoever can see the
-- job can see its estimate. No DELETE policy — a sent estimate is a document
-- someone may rely on, and removal is a status (§16.8 `expired`).
create policy estimates_member_select
  on public.estimates for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy estimates_member_insert
  on public.estimates for insert to authenticated
  with check (app_private.is_member_of(organization_id));

create policy estimates_member_update
  on public.estimates for update to authenticated
  using (app_private.is_member_of(organization_id))
  with check (app_private.is_member_of(organization_id));

create policy estimate_items_member_select
  on public.estimate_items for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy estimate_items_member_insert
  on public.estimate_items for insert to authenticated
  with check (app_private.is_member_of(organization_id));

create policy estimate_items_member_update
  on public.estimate_items for update to authenticated
  using (app_private.is_member_of(organization_id))
  with check (app_private.is_member_of(organization_id));

-- Items are the one place a DELETE policy earns its keep: removing a line from
-- a draft is ordinary editing, not destruction of a record.
create policy estimate_items_member_delete
  on public.estimate_items for delete to authenticated
  using (app_private.is_member_of(organization_id));

-- ---------------------------------------------------------------------------
-- Data API grants. `anon` gets nothing: the customer view is served by the
-- server after it checks the token (see note 1).
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.estimates to service_role;
grant select, insert, update, delete on public.estimate_items to service_role;

grant select, insert, update on public.estimates to authenticated;
grant select, insert, update, delete on public.estimate_items to authenticated;

commit;
