-- Where a generated estimate came from (§27.2, §16.4).
--
-- When an estimate with a strange set of line items turns up a month from now,
-- the question is "which prompt wrote this" — and without the answer stored on
-- the row there is nothing to reproduce it with. The model, the prompt version
-- and the schema version are properties of *that document*, not of the code
-- that happens to be deployed when someone goes looking: prompts get revised,
-- and the revised one would not produce the estimate being investigated.
--
-- `ai_confidence` is the model's own reading of how sure it is (§16.4). It is
-- stored rather than only shown, because the interesting question later is
-- whether low-confidence drafts got edited more before approval — which is how
-- we find out if the number means anything.
--
-- All columns are nullable and default to nothing: an estimate written by hand
-- has no provenance to record, and that must stay the ordinary case rather than
-- something the schema treats as missing data.

begin;

alter table public.estimates
  add column ai_model text,
  add column ai_prompt_version text,
  add column ai_schema_version text,
  add column ai_confidence numeric(3, 2),
  add column ai_generated_at timestamptz;

-- A fraction, as §16.4 defines it. Out-of-range means the parser let something
-- through, and a confidence of 87 rendered as "87%" would be a lie by a factor
-- of a hundred.
alter table public.estimates
  add constraint estimates_ai_confidence_check check (
    ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)
  );

-- Provenance travels together or not at all: a model with no prompt version is
-- exactly the half-record that cannot reproduce anything.
alter table public.estimates
  add constraint estimates_ai_provenance_complete check (
    (ai_model is null and ai_prompt_version is null and ai_schema_version is null
      and ai_generated_at is null)
    or (ai_model is not null and ai_prompt_version is not null
      and ai_schema_version is not null and ai_generated_at is not null)
  );

commit;
