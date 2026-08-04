import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildJobSearchFilter,
  derivePaymentStatus,
  groupByPaymentOutcome,
  isJobStatus,
  likePattern,
  normalizePhone,
  quoteFilterValue,
  sortSpec,
  viewFilter,
  type JobPriority,
  type JobSort,
  type JobStatus,
  type JobView,
  type PaymentStatus,
} from "./model";
import type { CustomerInput, JobFieldsInput } from "./schema";

/**
 * Job Tracker data access (§13). Every query goes through the session client,
 * so RLS — not this file — is what keeps organizations apart; the explicit
 * `organization_id` filters are for index selectivity and for failing loudly
 * if a caller ever passes the wrong id.
 *
 * The activity trail (§13.11) is written by database triggers, so nothing here
 * has to remember to log.
 */

export const PAGE_SIZE = 25;

export interface JobCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  preferred_locale: string;
  sms_consent: boolean;
  address: string | null;
  lead_source: string | null;
  notes: string | null;
}

export interface JobRow {
  id: string;
  organization_id: string;
  customer_id: string | null;
  title: string;
  service: string | null;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  source: string | null;
  address: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimate_amount: number | null;
  job_total: number | null;
  materials_cost: number | null;
  payment_status: PaymentStatus;
  assigned_user_id: string | null;
  last_follow_up_at: string | null;
  review_requested_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer: JobCustomer | null;
}

export interface JobActivityRow {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const JOB_COLUMNS =
  "id, organization_id, customer_id, title, service, description, status, priority, source, " +
  "address, scheduled_start, scheduled_end, estimate_amount, job_total, materials_cost, " +
  "payment_status, assigned_user_id, last_follow_up_at, review_requested_at, notes, " +
  "created_at, updated_at, deleted_at, " +
  "customers (id, name, phone, email, preferred_locale, sms_consent, address, lead_source, notes)";

type RawJobRow = Omit<JobRow, "customer"> & {
  customers: JobCustomer | JobCustomer[] | null;
};

function toJobRow(raw: RawJobRow): JobRow {
  const { customers, ...job } = raw;
  const customer = Array.isArray(customers) ? (customers[0] ?? null) : customers;
  return { ...job, customer: customer ?? null };
}

export interface ListJobsQuery {
  organizationId: string;
  view: JobView;
  sort: JobSort;
  search?: string;
  status?: JobStatus;
  priority?: JobPriority;
  assignedUserId?: string;
  /** Deleted jobs are hidden everywhere except the explicit "deleted" filter (§14.12). */
  deleted?: boolean;
  page: number;
}

export interface ListJobsResult {
  jobs: JobRow[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Customers whose name, phone or email matches the term. Searching jobs and
 * customers in one PostgREST call is not expressible (an `or` cannot span an
 * embedded resource), so the customer half runs first and feeds the job query
 * a list of ids.
 */
async function findMatchingCustomerIds(
  supabase: SupabaseClient,
  organizationId: string,
  term: string,
): Promise<string[]> {
  const pattern = quoteFilterValue(likePattern(term));
  const clauses = [`name.ilike.${pattern}`, `phone.ilike.${pattern}`, `email.ilike.${pattern}`];

  // A phone is searched in whatever shape it comes to mind — "310-555-0101",
  // "(310) 555-0101", "+1 310 555 0101", "3105550101". `normalizePhone` drops
  // the separators and the US country code, and the generated `phone_digits`
  // column (20260804000500) holds the stored number in the same shape.
  const digits = normalizePhone(term);
  if (digits && digits.length >= 3) {
    clauses.push(`phone_digits.ilike.${quoteFilterValue(`%${digits}%`)}`);
  }

  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .or(clauses.join(","))
    .limit(200);
  return (data ?? []).map((row) => row.id as string);
}

export async function listJobs(
  supabase: SupabaseClient,
  input: ListJobsQuery,
): Promise<ListJobsResult> {
  const page = Math.max(1, input.page);
  let query = supabase
    .from("jobs")
    .select(JOB_COLUMNS, { count: "exact" })
    .eq("organization_id", input.organizationId);

  query = input.deleted ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  const filter = viewFilter(input.view);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (filter.paymentStatuses) query = query.in("payment_status", filter.paymentStatuses);

  if (input.status) query = query.eq("status", input.status);
  if (input.priority) query = query.eq("priority", input.priority);
  if (input.assignedUserId) query = query.eq("assigned_user_id", input.assignedUserId);

  const term = input.search?.trim();
  if (term) {
    const customerIds = await findMatchingCustomerIds(supabase, input.organizationId, term);
    query = query.or(buildJobSearchFilter(term, customerIds));
  }

  const spec = sortSpec(input.sort);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(spec.column, { ascending: spec.ascending, nullsFirst: spec.nullsFirst })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw new Error(`jobs.list failed: ${error.code ?? "unknown"}`);

  const total = count ?? 0;
  return {
    jobs: ((data ?? []) as unknown as RawJobRow[]).map(toJobRow),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getJob(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return toJobRow(data as unknown as RawJobRow);
}

export async function getJobActivities(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  limit = 50,
): Promise<JobActivityRow[]> {
  const { data } = await supabase
    .from("job_activities")
    .select("id, event_type, actor_type, actor_id, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as JobActivityRow[];
}

export interface JobCounterRow {
  status: JobStatus;
  payment_status: PaymentStatus;
  scheduled_start: string | null;
}

/**
 * Raw material for the dashboard cards (§20.2). One query, counted in
 * JavaScript with the same `matchesView` predicate the list uses, so a card
 * and its view can never disagree.
 */
export async function loadJobCounters(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<JobCounterRow[]> {
  const { data } = await supabase
    .from("jobs")
    .select("status, payment_status, scheduled_start")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(5000);
  return (data ?? []) as JobCounterRow[];
}

export async function countDeletedJobs(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .not("deleted_at", "is", null);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Attaches the job to an existing customer or creates one. Matching is by
 * phone first, then email (§14.15 duplicate rules) — a returning customer must
 * not turn into a second record just because the name was typed differently.
 *
 * Consent is only ever raised, never silently cleared: withdrawing it is an
 * explicit action in the customer's own record (§17.9).
 */
async function resolveCustomerId(
  supabase: SupabaseClient,
  organizationId: string,
  input: CustomerInput,
  existingCustomerId: string | null,
): Promise<string | null> {
  const phone = normalizePhone(input.phone);
  let matchQuery = supabase
    .from("customers")
    .select("id, sms_consent")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(1);

  // Suffix match on the digits-only column, so "+1 310 555 0101" and
  // "(310) 555-0101" resolve to the same customer.
  if (phone) matchQuery = matchQuery.ilike("phone_digits", `%${phone}`);
  else if (input.email) matchQuery = matchQuery.eq("email", input.email);
  else if (existingCustomerId) matchQuery = matchQuery.eq("id", existingCustomerId);
  else matchQuery = matchQuery.eq("name", input.name);

  const { data: matched } = await matchQuery.maybeSingle();

  const consentFields = input.sms_consent
    ? {
        sms_consent: true,
        sms_consent_source: "owner_entry" as const,
        sms_consent_at: new Date().toISOString(),
      }
    : {};

  if (matched) {
    await supabase
      .from("customers")
      .update({
        name: input.name,
        phone: input.phone,
        email: input.email,
        preferred_locale: input.preferred_locale,
        address: input.address,
        ...consentFields,
      })
      .eq("id", matched.id)
      .eq("organization_id", organizationId);
    return matched.id as string;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      preferred_locale: input.preferred_locale,
      address: input.address,
      ...consentFields,
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id as string;
}

export async function createJob(
  supabase: SupabaseClient,
  organizationId: string,
  input: { customer: CustomerInput; job: JobFieldsInput },
): Promise<{ id: string } | { error: "generic" }> {
  const customerId = await resolveCustomerId(supabase, organizationId, input.customer, null);

  const { data, error } = await supabase
    .from("jobs")
    .insert({ organization_id: organizationId, customer_id: customerId, ...input.job })
    .select("id")
    .single();

  if (error || !data) return { error: "generic" };
  return { id: data.id as string };
}

export async function updateJob(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  input: { customer: CustomerInput; job: JobFieldsInput },
  existingCustomerId: string | null,
): Promise<{ id: string } | { error: "generic" }> {
  const customerId = await resolveCustomerId(
    supabase,
    organizationId,
    input.customer,
    existingCustomerId,
  );

  const { error } = await supabase
    .from("jobs")
    .update({ customer_id: customerId, ...input.job })
    .eq("id", jobId)
    .eq("organization_id", organizationId);

  if (error) return { error: "generic" };
  return { id: jobId };
}

/** Status change from the list or the card (§13.8). */
export async function setJobStatus(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  nextStatus: string,
): Promise<{ ok: true } | { error: "generic" | "invalid_choice" }> {
  if (!isJobStatus(nextStatus)) return { error: "invalid_choice" };

  const { data: current } = await supabase
    .from("jobs")
    .select("payment_status")
    .eq("organization_id", organizationId)
    .eq("id", jobId)
    .maybeSingle();
  if (!current) return { error: "generic" };

  const { error } = await supabase
    .from("jobs")
    .update({
      status: nextStatus,
      payment_status: derivePaymentStatus(nextStatus, current.payment_status as PaymentStatus),
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId);

  return error ? { error: "generic" } : { ok: true };
}

export const MAX_BULK_JOBS = 100;

/**
 * Bulk status change (§13.8). `derivePaymentStatus` depends on each job's
 * current payment status, so the selection is read once and then written back
 * grouped by outcome — at most four UPDATEs regardless of how many jobs were
 * picked. The activity trail is still one entry per job: the triggers see
 * every changed row (§13.11).
 */
export async function setJobsStatus(
  supabase: SupabaseClient,
  organizationId: string,
  jobIds: readonly string[],
  nextStatus: string,
): Promise<{ changed: number } | { error: "generic" | "invalid_choice" | "empty" | "too_many" }> {
  if (!isJobStatus(nextStatus)) return { error: "invalid_choice" };
  if (jobIds.length === 0) return { error: "empty" };
  if (jobIds.length > MAX_BULK_JOBS) return { error: "too_many" };

  const { data: current, error: readError } = await supabase
    .from("jobs")
    .select("id, payment_status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("id", jobIds);

  if (readError) return { error: "generic" };
  if (!current || current.length === 0) return { error: "empty" };

  const byPayment = groupByPaymentOutcome(
    current.map((row) => ({ id: row.id as string, payment_status: row.payment_status as PaymentStatus })),
    nextStatus,
  );

  let changed = 0;
  for (const [payment, ids] of byPayment) {
    const { error } = await supabase
      .from("jobs")
      .update({ status: nextStatus, payment_status: payment })
      .eq("organization_id", organizationId)
      .in("id", ids);
    if (error) return { error: "generic" };
    changed += ids.length;
  }

  return { changed };
}

/** Soft delete (§14.12): the row and its history stay, the list hides it. */
export async function setJobDeleted(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  deleted: boolean,
): Promise<{ ok: true } | { error: "generic" }> {
  const { error } = await supabase
    .from("jobs")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", jobId)
    .eq("organization_id", organizationId);

  return error ? { error: "generic" } : { ok: true };
}

/** Members who can be assigned a job (§13.5 "Assigned To"). */
export async function listAssignableMembers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ id: string; label: string }[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, profiles (display_name, email)")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.user_id as string,
      label: (profile?.display_name as string) || (profile?.email as string) || "—",
    };
  });
}
