-- One-time CSV import (§14.15) as a single atomic RPC.
--
-- Why an RPC rather than a batch of PostgREST inserts:
--   * a half-finished import is worse than none — one transaction, or nothing;
--   * customer matching (§14.15 step 4) has to happen against rows written
--     moments earlier in the same import, which a client-side loop cannot see;
--   * it is the only place that can set `handyalliance.activity_context`
--     transaction-locally, so a hundred rows produce `job.imported` entries
--     instead of a hundred `job.created` ones (§13.11).
--
-- SECURITY DEFINER bypasses RLS, so membership is checked explicitly on the
-- first line. Every value still passes the table CHECK constraints: a row the
-- client failed to validate aborts the whole import rather than being stored.

begin;

create or replace function public.import_jobs(
  p_organization_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  entry jsonb;
  customer_input jsonb;
  job_input jsonb;
  v_customer_id uuid;
  v_phone text;
  v_digits text;
  v_email extensions.citext;
  v_name text;
  jobs_created integer := 0;
  customers_created integer := 0;
  customers_matched integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not app_private.is_member_of(p_organization_id) then
    raise exception 'not a member of this organization';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'nothing to import';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'too many rows in one import';
  end if;

  -- Transaction-local, so it is safe under connection pooling. It is also
  -- cleared before returning: "local" means the whole transaction, and a
  -- caller that writes another job after importing must not have that write
  -- logged as an import.
  perform set_config('handyalliance.activity_context', 'import', true);

  for entry in select * from jsonb_array_elements(p_rows)
  loop
    customer_input := entry -> 'customer';
    job_input := entry -> 'job';

    if customer_input is null or job_input is null then
      raise exception 'each row needs a customer and a job';
    end if;

    v_name := nullif(trim(customer_input ->> 'name'), '');
    v_phone := nullif(trim(coalesce(customer_input ->> 'phone', '')), '');
    v_email := nullif(trim(coalesce(customer_input ->> 'email', '')), '')::extensions.citext;
    v_digits := nullif(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), '');
    -- Match the way normalizePhone() does, so a stored "+1 310…" and an
    -- imported "310…" are the same person.
    if v_digits is not null and length(v_digits) = 11 and left(v_digits, 1) = '1' then
      v_digits := right(v_digits, 10);
    end if;

    if v_name is null then
      raise exception 'every row needs a customer name';
    end if;

    -- Phone first, then email, then name — the order of §14.15 step 4.
    v_customer_id := null;
    if v_digits is not null then
      select c.id into v_customer_id
      from public.customers c
      where c.organization_id = p_organization_id
        and c.deleted_at is null
        and c.phone_digits like '%' || v_digits
      limit 1;
    end if;
    if v_customer_id is null and v_email is not null then
      select c.id into v_customer_id
      from public.customers c
      where c.organization_id = p_organization_id
        and c.deleted_at is null
        and c.email = v_email
      limit 1;
    end if;
    if v_customer_id is null then
      select c.id into v_customer_id
      from public.customers c
      where c.organization_id = p_organization_id
        and c.deleted_at is null
        and lower(c.name) = lower(v_name)
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers (
        organization_id, name, phone, email, preferred_locale, address, lead_source
      )
      values (
        p_organization_id,
        v_name,
        v_phone,
        v_email,
        coalesce(nullif(customer_input ->> 'preferred_locale', ''), 'en'),
        nullif(trim(coalesce(customer_input ->> 'address', '')), ''),
        nullif(job_input ->> 'source', '')
      )
      returning id into v_customer_id;
      customers_created := customers_created + 1;
    else
      customers_matched := customers_matched + 1;
    end if;

    insert into public.jobs (
      organization_id, customer_id, title, service, description, status, priority,
      source, address, scheduled_start, scheduled_end,
      estimate_amount, job_total, materials_cost, payment_status, notes
    )
    values (
      p_organization_id,
      v_customer_id,
      trim(job_input ->> 'title'),
      nullif(trim(coalesce(job_input ->> 'service', '')), ''),
      nullif(trim(coalesce(job_input ->> 'description', '')), ''),
      coalesce(nullif(job_input ->> 'status', ''), 'new_lead'),
      coalesce(nullif(job_input ->> 'priority', ''), 'normal'),
      nullif(job_input ->> 'source', ''),
      nullif(trim(coalesce(job_input ->> 'address', '')), ''),
      (nullif(job_input ->> 'scheduled_start', ''))::timestamptz,
      (nullif(job_input ->> 'scheduled_end', ''))::timestamptz,
      (nullif(job_input ->> 'estimate_amount', ''))::numeric,
      (nullif(job_input ->> 'job_total', ''))::numeric,
      (nullif(job_input ->> 'materials_cost', ''))::numeric,
      coalesce(nullif(job_input ->> 'payment_status', ''), 'unpaid'),
      nullif(trim(coalesce(job_input ->> 'notes', '')), '')
    );
    jobs_created := jobs_created + 1;
  end loop;

  perform set_config('handyalliance.activity_context', '', true);

  -- §26.6: a bulk data import is an auditable event in its own right.
  insert into public.audit_logs (
    organization_id, actor_type, actor_id, action, target_type, target_id, after_data
  )
  values (
    p_organization_id, 'user', auth.uid(), 'jobs.imported', 'organization',
    p_organization_id::text,
    jsonb_build_object(
      'jobs', jobs_created,
      'customers_created', customers_created,
      'customers_matched', customers_matched
    )
  );

  return jsonb_build_object(
    'jobs', jobs_created,
    'customers_created', customers_created,
    'customers_matched', customers_matched
  );
end;
$$;

revoke all on function public.import_jobs(uuid, jsonb) from public;
grant execute on function public.import_jobs(uuid, jsonb) to authenticated;

commit;
