-- SellerRelay MVP lead storage.
-- Run only in the Supabase project selected for SellerRelay.

create extension if not exists pgcrypto;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  locale text not null check (locale in ('en', 'ru')),
  intent text not null check (intent in ('custom_quote', 'pilot_shipment', 'agency')),
  contact_email text not null,
  contact_name text not null,
  country text not null,
  product_category text not null,
  monthly_volume text not null,
  shipment_size text not null,
  sku_count text not null,
  requested_services text[] not null default '{}',
  readiness_to_ship text not null,
  call_requested boolean not null default false,
  source text,
  campaign text,
  payload jsonb not null,
  file_paths text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'reviewing', 'qualified', 'quoted', 'not_eligible', 'closed')),
  consent_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  type text not null check (type in ('contact', 'agency')),
  locale text not null check (locale in ('en', 'ru')),
  contact_email text not null,
  payload jsonb not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'qualified', 'answered', 'closed')),
  source text,
  campaign text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_requests_created_at_idx on public.quote_requests (created_at desc);
create index if not exists quote_requests_status_idx on public.quote_requests (status, created_at desc);
create index if not exists quote_requests_country_idx on public.quote_requests (country, created_at desc);
create index if not exists quote_requests_intent_idx on public.quote_requests (intent, created_at desc);
create index if not exists lead_requests_created_at_idx on public.lead_requests (created_at desc);
create index if not exists lead_requests_type_idx on public.lead_requests (type, created_at desc);

alter table public.quote_requests enable row level security;
alter table public.lead_requests enable row level security;

revoke all on table public.quote_requests from anon, authenticated;
revoke all on table public.lead_requests from anon, authenticated;
grant all on table public.quote_requests to service_role;
grant all on table public.lead_requests to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sellerrelay-private',
  'sellerrelay-private',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated storage policy is created. Uploads and reads use only
-- the server-side service role. Add narrowly scoped internal policies later
-- if an authenticated operations dashboard is introduced.
