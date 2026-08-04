-- Phone search that survives formatting (§13.8).
--
-- Customers are stored with the phone exactly as the owner typed it —
-- "(310) 555-0101" — but they search for "310-555-0101" or "3105550101".
-- A generated digits-only column makes all three the same string, and keeps
-- the normalisation in one place instead of in every query.
--
-- This mirrors `normalizePhone()` in src/features/jobs/model.ts, minus the
-- country-code trim: matching is done with a suffix/substring pattern, so a
-- stored "+1 310…" still matches a searched "310…".

begin;

alter table public.customers
  add column phone_digits text
  generated always as (
    nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
  ) stored;

create index customers_org_phone_digits_idx
  on public.customers (organization_id, phone_digits)
  where phone_digits is not null;

create index customers_phone_digits_trgm_idx
  on public.customers using gin (phone_digits extensions.gin_trgm_ops);

commit;
