-- Business Website (Stage 5, §19) — settings and content.
--
-- Conventions as before: CHECK registries instead of enums, RLS enabled AND
-- forced, explicit Data API grants, `updated_at` triggers, no DELETE policies
-- on anything a customer may have seen.
--
-- Four decisions worth reading before the DDL.
--
-- 1. There is no `language_mode` column. §19.5 lets the owner run the site in
--    English, in Spanish, or in both — and `business_profiles.supported_locales`
--    already records exactly that, constrained to a subset of {en, es}. A second
--    column saying the same thing is a second column to disagree with the first,
--    and the first is the one onboarding already writes.
--
-- 2. Content is a row per locale, not a jsonb blob keyed by locale.
--    §19.5 requires that a machine translation is a *draft* until a person
--    confirms it — which is a fact about one language, with its own timestamps.
--    Per-locale rows carry that naturally (`ai_generated_at`, `reviewed_at`,
--    the same provenance pair the estimates carry since 20260805000400); a blob
--    would have to invent a parallel structure to hold it, and every read would
--    have to trust that the structure is well-formed.
--
-- 3. `status` starts at 'draft' and nothing in this migration's PR moves it.
--    That is deliberate rather than aspirational: §19.10 requires that a private
--    draft is not publicly reachable, so the column that says "not public yet"
--    has to exist *before* the public renderer does, and it has to default to
--    the safe answer. Publishing, versions and rollback are a later change that
--    adds its own table and its own writer.
--
-- 4. No `photos` column and no storage bucket here. Nothing can populate them
--    yet, and the current-state audit's §4.4 names a schema whose writers do not
--    exist as a defect worth not inheriting. The gallery block arrives with the
--    bucket that fills it.

begin;

-- ---------------------------------------------------------------------------
-- The site itself: one per organization (§19, LIMITS.business_website
-- sitesPerOrganization = 1, which is why the organization is the primary key
-- rather than a row that could be inserted twice).
-- ---------------------------------------------------------------------------

create table public.business_sites (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  -- Template and colour are registries, not free text: §19.9 forbids custom
  -- design, and a text column would be an invitation to add one per customer.
  template text not null default 'classic',
  color_preset text not null default 'navy',
  status text not null default 'draft',
  -- Blocks the owner has switched off. Stored as the exceptions rather than as
  -- the enabled set so that a block added later is on by default and no
  -- existing row has to be migrated to find out about it.
  hidden_blocks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_sites_template_check check (
    template in ('classic', 'bold', 'compact')
  ),
  constraint business_sites_color_check check (
    color_preset in ('navy', 'forest', 'sunset', 'slate', 'brick')
  ),
  constraint business_sites_status_check check (status in ('draft', 'published')),
  -- The switchable subset of §19.4. Hero and Footer are absent on purpose: a
  -- page with no opening and no contact details at the bottom is not one of the
  -- shapes this tool offers. Gallery is absent for a different reason — it has
  -- nothing to show until photo upload exists, and recording it as *hidden*
  -- today would leave every site built before then switched off on the day the
  -- photos arrive, with nobody knowing to go and switch it back on.
  constraint business_sites_hidden_blocks_check check (
    hidden_blocks <@ array[
      'services', 'why_choose_us', 'about', 'reviews',
      'service_area', 'faq', 'contact_form', 'call_button'
    ]
  )
);

-- ---------------------------------------------------------------------------
-- Content, one row per language the site is offered in (§19.5).
-- ---------------------------------------------------------------------------

create table public.business_site_texts (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  locale text not null,
  headline text,
  subheadline text,
  about_text text,
  cta_text text,
  service_area_note text,
  -- §19.4 blocks 3 and 8. Arrays of strings and of {question, answer}; the
  -- shape is checked in the application, the type is checked here so a
  -- malformed write cannot make a page fail to render for everyone.
  why_choose_us jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  -- Provenance (§19.5, §27). `ai_generated_at` is set when the model wrote this
  -- language; `reviewed_at` when a person confirmed it. Neither is a boolean,
  -- because "confirmed, then regenerated" has to read as unconfirmed again —
  -- which it does exactly when `reviewed_at < ai_generated_at`.
  ai_generated_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, locale),
  constraint business_site_texts_locale_check check (locale in ('en', 'es')),
  constraint business_site_texts_why_is_array check (jsonb_typeof(why_choose_us) = 'array'),
  constraint business_site_texts_faq_is_array check (jsonb_typeof(faq) = 'array')
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (same registry pattern as the earlier migrations).
-- ---------------------------------------------------------------------------

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['business_sites', 'business_site_texts']
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
--
-- Reads are member-wide: staff who can see the jobs can see what the business
-- says about itself. Writes are owner-only, because this is the copy the
-- public reads under the owner's own name (§11.3) — the same reason connecting
-- Google is owner-only.
-- ---------------------------------------------------------------------------

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['business_sites', 'business_site_texts']
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('alter table public.%I force row level security', relation_name);
  end loop;
end;
$$;

create policy business_sites_member_select
  on public.business_sites for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy business_sites_owner_insert
  on public.business_sites for insert to authenticated
  with check (app_private.is_org_owner(organization_id));

create policy business_sites_owner_update
  on public.business_sites for update to authenticated
  using (app_private.is_org_owner(organization_id))
  with check (app_private.is_org_owner(organization_id));

create policy business_site_texts_member_select
  on public.business_site_texts for select to authenticated
  using (app_private.is_member_of(organization_id));

create policy business_site_texts_owner_insert
  on public.business_site_texts for insert to authenticated
  with check (app_private.is_org_owner(organization_id));

create policy business_site_texts_owner_update
  on public.business_site_texts for update to authenticated
  using (app_private.is_org_owner(organization_id))
  with check (app_private.is_org_owner(organization_id));

-- Dropping a language is ordinary editing, not destruction of a record: a site
-- that stops being bilingual should stop carrying a half-written Spanish page.
create policy business_site_texts_owner_delete
  on public.business_site_texts for delete to authenticated
  using (app_private.is_org_owner(organization_id));

-- ---------------------------------------------------------------------------
-- Data API grants. `anon` gets nothing here even though this content is
-- destined to be public: the public page is rendered server-side from the
-- published version, so the browser never needs to query these tables — and a
-- grant would expose every unpublished draft to anyone who asks PostgREST for
-- one (§19.10: a private draft is not publicly available).
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.business_sites to service_role;
grant select, insert, update, delete on public.business_site_texts to service_role;

grant select, insert, update on public.business_sites to authenticated;
grant select, insert, update, delete on public.business_site_texts to authenticated;

commit;
