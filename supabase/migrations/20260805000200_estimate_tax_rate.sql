-- The tax rate the estimate was priced at (§16).
--
-- 20260805000100 stored the tax *amount* but not the rate that produced it,
-- which is one column short of a document. Reopening an estimate could not show
-- the rate back, so editing a line silently repriced it at 0% — and the printed
-- estimate could not say "Tax (8.25%)", which is the line a customer checks.
--
-- Stored per estimate rather than per organization: the rate is a property of
-- the document as approved. A business that changes its rate next year must not
-- retroactively change what a customer already accepted.

begin;

alter table public.estimates
  add column tax_rate numeric(6, 4) not null default 0;

-- A fraction, not a percentage. The bound is deliberately loose enough for any
-- real US combined rate and tight enough that 8.25 entered instead of 0.0825
-- fails here instead of multiplying an invoice by a hundred.
alter table public.estimates
  add constraint estimates_tax_rate_check check (tax_rate >= 0 and tax_rate <= 0.5);

-- `expired` was missing from the statuses that need no public link.
--
-- The constraint's intent is that a status the customer can act on must have a
-- link they can open. `expired` is not one of those: an estimate can be shelved
-- without ever having been sent, and the state machine allows draft → expired
-- and ready → expired. As written, both were rejected by the database — the
-- owner would have got an unexplained failure on a button that should work.
alter table public.estimates
  drop constraint estimates_sent_has_token;

alter table public.estimates
  add constraint estimates_sent_has_token check (
    status in ('draft', 'ready', 'expired') or public_token is not null
  );

commit;
