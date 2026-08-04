-- Minimal Supabase environment shim for running migrations and RLS tests
-- against a plain Postgres (local development and CI). It recreates only the
-- pieces of the Supabase runtime the migrations rely on: the anon /
-- authenticated / service_role roles, the auth schema with auth.users, and
-- auth.uid() reading the request JWT claim. Never run this against a real
-- Supabase project — there these objects already exist.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Deliberately NO default table grants. Supabase's current cloud default is to
-- leave new tables unexposed, so the migrations must grant explicitly
-- (20260804000800). Auto-granting here would hide a missing grant until it
-- surfaced in a browser.

-- Supabase grants EXECUTE on every new function directly to these roles, and
-- a `revoke ... from public` does not remove a direct grant. Reproducing that
-- here is what lets the RLS tests catch a SECURITY DEFINER function that ships
-- callable by anon (advisor 0028) — twice now it has been caught only after
-- deploy, see 20260804000200 and 20260804000700.
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
