-- HandyAlliance platform foundation (Stage 1, spec §25.1/§25.9/§25.11, RLS §26.1).
-- Conventions per audit §4.2 (ported from BizMetria): status registries as
-- CHECK constraints (not enums), jsonb_typeof guards, forced RLS on every
-- table, security-definer helpers with pinned search_path, immutable audit log.
--
-- Multi-tenancy is organization-based from day one (§26.1): every tenant table
-- carries organization_id and every policy goes through app_private.is_member_of.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profiles: mirror of auth.users plus interface preferences (§9.3).
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null,
  display_name text,
  owner_interface_locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_locale_check check (owner_interface_locale in ('en', 'es'))
);

create unique index profiles_email_unique_active
  on public.profiles (email)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Platform administrators (§11.5, §22). Separate from organization roles.
-- ---------------------------------------------------------------------------

create table public.admin_roles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_roles_role_check check (role in ('admin', 'support'))
);

-- ---------------------------------------------------------------------------
-- Organizations & memberships (§25.1). Roles per §11: owner / staff.
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  trade text not null,
  timezone text not null default 'America/New_York',
  currency text not null default 'usd',
  default_locale text not null default 'en',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_name_not_blank check (length(trim(name)) > 0),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9](-?[a-z0-9])*$'),
  constraint organizations_trade_check check (
    trade in ('handyman', 'plumbing', 'hvac', 'electrical', 'cleaning', 'appliance_repair', 'other')
  ),
  constraint organizations_locale_check check (default_locale in ('en', 'es')),
  constraint organizations_currency_check check (currency = 'usd'),
  constraint organizations_status_check check (status in ('active', 'suspended', 'closed'))
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'staff',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint organization_members_role_check check (role in ('owner', 'staff')),
  constraint organization_members_status_check check (status in ('invited', 'active', 'removed')),
  constraint organization_members_permissions_object_check check (jsonb_typeof(permissions) = 'object')
);

create index organization_members_user_idx on public.organization_members (user_id);

-- Business profile: one per organization (§12, §25.1).
create table public.business_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  display_name text not null,
  owner_name text,
  phone text,
  email extensions.citext,
  logo_path text,
  services jsonb not null default '[]'::jsonb,
  service_area jsonb not null default '{}'::jsonb,
  business_hours jsonb not null default '{}'::jsonb,
  google_review_url text,
  supported_locales text[] not null default array['en'],
  notification_settings jsonb not null default '{}'::jsonb,
  website_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_display_name_check check (length(trim(display_name)) > 0),
  constraint business_profiles_services_array_check check (jsonb_typeof(services) = 'array'),
  constraint business_profiles_service_area_object_check check (jsonb_typeof(service_area) = 'object'),
  constraint business_profiles_hours_object_check check (jsonb_typeof(business_hours) = 'object'),
  constraint business_profiles_notifications_object_check check (jsonb_typeof(notification_settings) = 'object'),
  constraint business_profiles_locales_check check (supported_locales <@ array['en', 'es']),
  constraint business_profiles_website_slug_format check (
    website_slug is null or website_slug ~ '^[a-z0-9](-?[a-z0-9])*$'
  )
);

-- ---------------------------------------------------------------------------
-- Billing (§25.9). Stripe is the source of truth via webhooks (§6.2.4);
-- these tables are the local cache that entitlements resolve against.
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  product_code text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_product_check check (
    product_code in (
      'call_answering', 'estimate_quote_maker', 'reviews_followups',
      'bad_lead_refund_helper', 'business_website', 'all_tools_bundle'
    )
  ),
  constraint subscriptions_status_check check (
    status in (
      'active', 'trialing', 'past_due', 'unpaid', 'canceled',
      'incomplete', 'incomplete_expired', 'paused'
    )
  )
);

create index subscriptions_organization_idx on public.subscriptions (organization_id);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

create table public.entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_code text not null,
  source_subscription_id uuid references public.subscriptions (id) on delete set null,
  status text not null default 'active',
  limits jsonb not null default '{}'::jsonb,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_code),
  constraint entitlements_feature_check check (
    feature_code in (
      'job_tracker', 'call_answering', 'estimate_quote_maker', 'reviews_followups',
      'bad_lead_refund_helper', 'business_website', 'all_tools_bundle'
    )
  ),
  constraint entitlements_status_check check (status in ('active', 'suspended', 'revoked')),
  constraint entitlements_limits_object_check check (jsonb_typeof(limits) = 'object')
);

create table public.usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_code text not null,
  quantity numeric not null,
  provider_cost numeric,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_events_feature_check check (
    feature_code in (
      'job_tracker', 'call_answering', 'estimate_quote_maker', 'reviews_followups',
      'bad_lead_refund_helper', 'business_website', 'all_tools_bundle'
    )
  ),
  constraint usage_events_quantity_check check (quantity >= 0),
  constraint usage_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index usage_events_org_feature_idx
  on public.usage_events (organization_id, feature_code, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Webhook idempotency (§26.4, audit §4.2): unique (provider, event id),
-- sanitized payload only, bounded attempts.
-- ---------------------------------------------------------------------------

create table public.webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  signature_verified boolean not null default false,
  payload_hash text not null,
  sanitized_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  attempt_count integer not null default 0,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_events_provider_check check (
    provider in ('stripe', 'retell', 'resend', 'sms', 'google')
  ),
  constraint webhook_events_payload_object_check check (jsonb_typeof(sanitized_payload) = 'object'),
  constraint webhook_events_status_check check (
    processing_status in ('received', 'verified', 'processing', 'processed', 'failed', 'ignored')
  ),
  constraint webhook_events_attempt_check check (attempt_count between 0 and 20),
  unique (provider, external_event_id)
);

-- ---------------------------------------------------------------------------
-- Audit log (§25.11, §26.6): append-only, enforced by trigger.
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_type text not null,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_type_check check (actor_type in ('user', 'admin', 'system', 'webhook')),
  constraint audit_logs_action_not_blank check (length(trim(action)) > 0),
  constraint audit_logs_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);

create or replace function app_private.audit_logs_block_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'audit_logs are immutable';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function app_private.audit_logs_block_mutation();

-- ---------------------------------------------------------------------------
-- Notifications (§25.11, §28).
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  severity text not null default 'info',
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_severity_check check (severity in ('info', 'warning', 'critical')),
  constraint notifications_type_not_blank check (length(trim(type)) > 0)
);

create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_org_idx on public.notifications (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers (single loop over the registry).
-- ---------------------------------------------------------------------------

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'profiles',
    'admin_roles',
    'organizations',
    'organization_members',
    'business_profiles',
    'subscriptions',
    'entitlements',
    'webhook_events'
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
-- New auth user → profile mirror.
-- ---------------------------------------------------------------------------

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name, owner_interface_locale)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    case
      when new.raw_user_meta_data ->> 'preferred_locale' = 'es' then 'es'
      else 'en'
    end
  )
  on conflict (id) do update
  set email = excluded.email, updated_at = now();

  return new;
end;
$$;

create trigger auth_user_created_profile
  after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Membership helpers (§26.1). SECURITY DEFINER with pinned search_path so
-- RLS policies can consult memberships without recursive policy evaluation.
-- ---------------------------------------------------------------------------

create or replace function app_private.is_member_of(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app_private.member_role(target_organization_id uuid)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = target_organization_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function app_private.is_org_owner(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select app_private.member_role(target_organization_id) = 'owner';
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_roles r
    where r.profile_id = auth.uid()
      and r.is_active
  );
$$;

revoke all on function app_private.is_member_of(uuid) from public;
revoke all on function app_private.member_role(uuid) from public;
revoke all on function app_private.is_org_owner(uuid) from public;
revoke all on function app_private.is_admin() from public;
grant execute on function app_private.is_member_of(uuid) to authenticated;
grant execute on function app_private.member_role(uuid) to authenticated;
grant execute on function app_private.is_org_owner(uuid) to authenticated;
grant execute on function app_private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Organization creation: one atomic RPC (org + owner membership + business
-- profile + free Job Tracker entitlement §13.1 + audit entry). Direct INSERTs
-- into organizations are denied by RLS, so this is the only path.
-- ---------------------------------------------------------------------------

create or replace function app_private.slugify(source text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(source), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'business'
  );
$$;

create or replace function public.create_organization(
  org_name text,
  org_trade text,
  org_default_locale text default 'en',
  org_timezone text default 'America/New_York'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  new_organization_id uuid;
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  base_slug := app_private.slugify(org_name);
  candidate_slug := base_slug;
  loop
    exit when not exists (select 1 from public.organizations o where o.slug = candidate_slug);
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
    if suffix > 50 then
      candidate_slug := base_slug || '-' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8);
      exit;
    end if;
  end loop;

  insert into public.organizations (name, slug, trade, default_locale, timezone)
  values (trim(org_name), candidate_slug, org_trade, org_default_locale, org_timezone)
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (new_organization_id, current_user_id, 'owner', 'active', now());

  insert into public.business_profiles (organization_id, display_name)
  values (new_organization_id, trim(org_name));

  -- Job Tracker is free for every organization (§13.1, §3.5).
  insert into public.entitlements (organization_id, feature_code, status)
  values (new_organization_id, 'job_tracker', 'active');

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, target_type, target_id, after_data)
  values (
    new_organization_id, 'user', current_user_id, 'organization.created',
    'organization', new_organization_id::text,
    jsonb_build_object('name', trim(org_name), 'trade', org_trade, 'slug', candidate_slug)
  );

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: enable + force on every table (registry loop).
-- No policy = deny; service_role bypasses RLS by design.
-- ---------------------------------------------------------------------------

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'profiles',
    'admin_roles',
    'organizations',
    'organization_members',
    'business_profiles',
    'subscriptions',
    'entitlements',
    'usage_events',
    'webhook_events',
    'audit_logs',
    'notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('alter table public.%I force row level security', relation_name);
  end loop;
end;
$$;

-- profiles: self only.
create policy profiles_self_select
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_self_update
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- admin_roles: a non-admin sees zero rows; nobody writes via anon/authenticated.
create policy admin_roles_self_select
  on public.admin_roles for select to authenticated
  using (profile_id = auth.uid());

-- organizations: members read; owners update; creation only via RPC.
create policy organizations_member_select
  on public.organizations for select to authenticated
  using (app_private.is_member_of(id));

create policy organizations_owner_update
  on public.organizations for update to authenticated
  using (app_private.is_org_owner(id))
  with check (app_private.is_org_owner(id));

-- organization_members: members see the member list of their org;
-- owners manage members (invites become an RPC in a later stage).
create policy organization_members_member_select
  on public.organization_members for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy organization_members_owner_insert
  on public.organization_members for insert to authenticated
  with check (app_private.is_org_owner(organization_id));

create policy organization_members_owner_update
  on public.organization_members for update to authenticated
  using (app_private.is_org_owner(organization_id))
  with check (app_private.is_org_owner(organization_id));

create policy organization_members_owner_delete
  on public.organization_members for delete to authenticated
  using (app_private.is_org_owner(organization_id));

-- business_profiles: members read; owners update (staff permissions later).
create policy business_profiles_member_select
  on public.business_profiles for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy business_profiles_owner_update
  on public.business_profiles for update to authenticated
  using (app_private.is_org_owner(organization_id))
  with check (app_private.is_org_owner(organization_id));

-- subscriptions: billing is owner-only (§11.3); writes come from webhooks (service role).
create policy subscriptions_owner_select
  on public.subscriptions for select to authenticated
  using (app_private.is_org_owner(organization_id));

-- entitlements: every member may read (the UI gates tools on this); writes are server-side.
create policy entitlements_member_select
  on public.entitlements for select to authenticated
  using (app_private.is_member_of(organization_id));

-- usage_events: owner-only visibility; writes are server-side.
create policy usage_events_owner_select
  on public.usage_events for select to authenticated
  using (app_private.is_org_owner(organization_id));

-- webhook_events: service-role only (no policies).

-- audit_logs: owners see their organization's log; inserts are server-side or SECURITY DEFINER.
create policy audit_logs_owner_select
  on public.audit_logs for select to authenticated
  using (organization_id is not null and app_private.is_org_owner(organization_id));

-- notifications: recipients read and mark as read.
create policy notifications_recipient_select
  on public.notifications for select to authenticated
  using (
    app_private.is_member_of(organization_id)
    and (user_id is null or user_id = auth.uid())
  );

create policy notifications_recipient_update
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
