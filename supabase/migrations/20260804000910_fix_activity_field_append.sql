-- Fix: editing a job or a customer failed outright.
--
-- `changed` is `text[]`, and the trigger appended field names with
--
--     changed := changed || 'title';
--
-- A quoted literal with no cast is of unknown type, and for `||` Postgres
-- prefers `anyarray || anyarray` over `anyarray || anyelement`. So it tried to
-- read `'title'` as an array literal and raised
--
--     malformed array literal: "title"
--
-- The trigger is AFTER UPDATE, so the exception aborted the whole statement:
-- the edit was not saved, and the user got a failure instead of their change.
--
-- Reachable from the main path of the feature. `job.updated` is the branch
-- taken when the status, assignee and `deleted_at` are all unchanged — that is
-- exactly "open a job, correct the address or the total, save". Every plain
-- field edit of a job or a customer failed; only the status change, the soft
-- delete and the restore worked, because each of those returns from an earlier
-- branch and never reaches the append.
--
-- Which is also why nothing caught it. The RLS suite and the end-to-end specs
-- both covered creation, status change, soft delete and restore — the three
-- paths that happen to skip this code — and neither ever edited a field and
-- saved. Coverage of the states around a thing is not coverage of the thing.
-- Both suites now include a plain field edit.
--
-- The fix is `array_append`, not a cast: the ambiguity is the defect, and a
-- function that takes an element cannot be read as anything else.

begin;

create or replace function app_private.record_job_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  resolved_event text;
  changed text[] := array[]::text[];
  details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    resolved_event := case
      when app_private.activity_context() = 'import' then 'job.imported'
      else 'job.created'
    end;
    details := jsonb_build_object('status', new.status);
  else
    -- Soft delete and restore are their own events (§14.12).
    if old.deleted_at is null and new.deleted_at is not null then
      resolved_event := 'job.deleted';
    elsif old.deleted_at is not null and new.deleted_at is null then
      resolved_event := 'job.restored';
    elsif old.status is distinct from new.status then
      resolved_event := 'job.status_changed';
      details := jsonb_build_object('from', old.status, 'to', new.status);
    elsif old.assigned_user_id is distinct from new.assigned_user_id then
      resolved_event := 'job.assigned';
      details := jsonb_build_object('to', new.assigned_user_id);
    else
      resolved_event := 'job.updated';
    end if;

    if resolved_event = 'job.updated' then
      -- Field names only: the activity feed logs what changed, never the
      -- customer data itself (§26.6 logs actions, not payloads).
      if old.title is distinct from new.title then changed := array_append(changed, 'title'); end if;
      if old.service is distinct from new.service then changed := array_append(changed, 'service'); end if;
      if old.description is distinct from new.description then changed := array_append(changed, 'description'); end if;
      if old.priority is distinct from new.priority then changed := array_append(changed, 'priority'); end if;
      if old.address is distinct from new.address then changed := array_append(changed, 'address'); end if;
      if old.scheduled_start is distinct from new.scheduled_start then changed := array_append(changed, 'scheduled_start'); end if;
      if old.scheduled_end is distinct from new.scheduled_end then changed := array_append(changed, 'scheduled_end'); end if;
      if old.estimate_amount is distinct from new.estimate_amount then changed := array_append(changed, 'estimate_amount'); end if;
      if old.job_total is distinct from new.job_total then changed := array_append(changed, 'job_total'); end if;
      if old.materials_cost is distinct from new.materials_cost then changed := array_append(changed, 'materials_cost'); end if;
      if old.payment_status is distinct from new.payment_status then changed := array_append(changed, 'payment_status'); end if;
      if old.customer_id is distinct from new.customer_id then changed := array_append(changed, 'customer'); end if;
      if old.notes is distinct from new.notes then changed := array_append(changed, 'notes'); end if;
      if old.source is distinct from new.source then changed := array_append(changed, 'source'); end if;

      -- Nothing meaningful changed (e.g. a no-op save): skip the entry.
      if array_length(changed, 1) is null then
        return new;
      end if;
      details := jsonb_build_object('fields', to_jsonb(changed));
    end if;
  end if;

  insert into public.job_activities (
    organization_id, job_id, customer_id, event_type, actor_type, actor_id, metadata
  )
  values (
    new.organization_id, new.id, new.customer_id, resolved_event,
    app_private.current_actor_type(), auth.uid(), details
  );

  return new;
end;
$$;

create or replace function app_private.record_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  resolved_event text;
  changed text[] := array[]::text[];
  details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    resolved_event := case
      when app_private.activity_context() = 'import' then 'customer.imported'
      else 'customer.created'
    end;
  elsif old.deleted_at is null and new.deleted_at is not null then
    resolved_event := 'customer.deleted';
  else
    resolved_event := 'customer.updated';
    if old.name is distinct from new.name then changed := array_append(changed, 'name'); end if;
    if old.phone is distinct from new.phone then changed := array_append(changed, 'phone'); end if;
    if old.email is distinct from new.email then changed := array_append(changed, 'email'); end if;
    if old.address is distinct from new.address then changed := array_append(changed, 'address'); end if;
    if old.preferred_locale is distinct from new.preferred_locale then changed := array_append(changed, 'preferred_locale'); end if;
    if old.lead_source is distinct from new.lead_source then changed := array_append(changed, 'lead_source'); end if;
    if old.notes is distinct from new.notes then changed := array_append(changed, 'notes'); end if;
    if old.sms_consent is distinct from new.sms_consent then changed := array_append(changed, 'sms_consent'); end if;
    if old.email_marketing_consent is distinct from new.email_marketing_consent then
      changed := array_append(changed, 'email_marketing_consent');
    end if;
    if old.deleted_at is distinct from new.deleted_at then changed := array_append(changed, 'deleted_at'); end if;

    if array_length(changed, 1) is null then
      return new;
    end if;
    details := jsonb_build_object('fields', to_jsonb(changed));
  end if;

  insert into public.job_activities (
    organization_id, customer_id, event_type, actor_type, actor_id, metadata
  )
  values (
    new.organization_id, new.id, resolved_event,
    app_private.current_actor_type(), auth.uid(), details
  );

  return new;
end;
$$;

commit;
