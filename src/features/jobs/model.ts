/**
 * Job Tracker domain model (§13) — pure, no I/O, no framework.
 *
 * The registries here mirror the CHECK constraints of
 * `supabase/migrations/20260804000400_job_tracker.sql`. Codes are stable and
 * never localized (§13.6); display strings live in the dictionaries.
 */

export const JOB_STATUSES = [
  "new_lead",
  "contacted",
  "estimate_draft",
  "estimate_sent",
  "estimate_accepted",
  "scheduled",
  "in_progress",
  "completed",
  "paid",
  "lost",
  "canceled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = ["normal", "urgent"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Lead sources offered at onboarding (§10.2 step 5) and on every job (§13.5). */
export const LEAD_SOURCES = [
  "phone_call",
  "website",
  "thumbtack",
  "yelp",
  "google",
  "referral",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const CUSTOMER_LOCALES = ["en", "es"] as const;
export type CustomerLocale = (typeof CUSTOMER_LOCALES)[number];

export const SMS_CONSENT_SOURCES = [
  "customer_form",
  "owner_entry",
  "import",
  "phone_call",
  "website_lead",
] as const;
export type SmsConsentSource = (typeof SMS_CONSENT_SOURCES)[number];

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Views (§13.7)
// ---------------------------------------------------------------------------

export const JOB_VIEWS = [
  "all_jobs",
  "new_leads",
  "estimates",
  "scheduled",
  "in_progress",
  "completed",
  "unpaid",
  "lost",
] as const;

export type JobView = (typeof JOB_VIEWS)[number];

export const DEFAULT_VIEW: JobView = "all_jobs";

export interface ViewFilter {
  /** Undefined = no status restriction. */
  statuses?: readonly JobStatus[];
  /** Undefined = no payment restriction. */
  paymentStatuses?: readonly PaymentStatus[];
}

/**
 * "Unpaid" answers the owner's real question — *who still owes me money* — so
 * it spans committed work (estimate accepted onwards) that has not been
 * collected in full, rather than a single status code.
 */
const VIEW_FILTERS: Record<JobView, ViewFilter> = {
  all_jobs: {},
  new_leads: { statuses: ["new_lead", "contacted"] },
  estimates: { statuses: ["estimate_draft", "estimate_sent", "estimate_accepted"] },
  scheduled: { statuses: ["scheduled"] },
  in_progress: { statuses: ["in_progress"] },
  completed: { statuses: ["completed", "paid"] },
  unpaid: {
    statuses: ["estimate_accepted", "scheduled", "in_progress", "completed"],
    paymentStatuses: ["unpaid", "partial"],
  },
  lost: { statuses: ["lost", "canceled"] },
};

export function isJobView(value: string): value is JobView {
  return (JOB_VIEWS as readonly string[]).includes(value);
}

export function parseView(value: string | undefined): JobView {
  return value && isJobView(value) ? value : DEFAULT_VIEW;
}

export function viewFilter(view: JobView): ViewFilter {
  return VIEW_FILTERS[view];
}

/** Client-side counterpart of the query filter — used by tests and by counters. */
export function matchesView(
  job: { status: JobStatus; payment_status: PaymentStatus },
  view: JobView,
): boolean {
  const filter = VIEW_FILTERS[view];
  if (filter.statuses && !filter.statuses.includes(job.status)) return false;
  if (filter.paymentStatuses && !filter.paymentStatuses.includes(job.payment_status)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Sorting (§13.8)
// ---------------------------------------------------------------------------

export const JOB_SORTS = ["newest", "oldest", "scheduled", "amount"] as const;
export type JobSort = (typeof JOB_SORTS)[number];
export const DEFAULT_SORT: JobSort = "newest";

export function parseSort(value: string | undefined): JobSort {
  return value && (JOB_SORTS as readonly string[]).includes(value) ? (value as JobSort) : DEFAULT_SORT;
}

export interface SortSpec {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

export function sortSpec(sort: JobSort): SortSpec {
  switch (sort) {
    case "oldest":
      return { column: "created_at", ascending: true, nullsFirst: false };
    case "scheduled":
      // Unscheduled work belongs at the bottom of a schedule list, not the top.
      return { column: "scheduled_start", ascending: true, nullsFirst: false };
    case "amount":
      return { column: "job_total", ascending: false, nullsFirst: false };
    case "newest":
    default:
      return { column: "created_at", ascending: false, nullsFirst: false };
  }
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/**
 * Keep the two money fields honest without being clever: marking a job `paid`
 * settles it, and reopening a settled job stops claiming the money arrived.
 * Any other combination is the owner's business.
 */
export function derivePaymentStatus(
  nextStatus: JobStatus,
  currentPaymentStatus: PaymentStatus,
): PaymentStatus {
  if (nextStatus === "paid") return "paid";
  if (currentPaymentStatus === "paid" && (nextStatus === "lost" || nextStatus === "canceled")) {
    return "refunded";
  }
  return currentPaymentStatus;
}

/** Statuses that mean the job is over, one way or another. */
export const CLOSED_STATUSES: readonly JobStatus[] = ["paid", "lost", "canceled"];

export function isClosed(status: JobStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Customer identity (used by the job form and by CSV import, §14.15)
// ---------------------------------------------------------------------------

/**
 * Phone digits only, with the US country code dropped, so `(310) 555-0101`,
 * `310-555-0101` and `+1 310 555 0101` are recognised as one customer.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length === 0) return null;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Identity key for duplicate detection (§14.15 step 4). Phone wins over email,
 * email over name: a handyman re-types a name a dozen ways but a phone number
 * only one.
 */
export function customerMatchKey(input: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): string | null {
  const phone = normalizePhone(input.phone);
  if (phone) return `phone:${phone}`;
  const email = normalizeEmail(input.email);
  if (email) return `email:${email}`;
  const name = normalizeName(input.name).toLowerCase();
  return name ? `name:${name}` : null;
}

// ---------------------------------------------------------------------------
// Money & dates
// ---------------------------------------------------------------------------

/**
 * Parses user- and spreadsheet-entered money: `$1,280.50`, `1 280,50`, `280`.
 * Returns null for blanks and undefined for values that are not a number, so
 * the caller can tell "left empty" from "typed something wrong".
 */
export function parseMoney(raw: string | null | undefined): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  let cleaned = trimmed.replace(/[$\s ]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) {
    // European style: comma is the decimal separator.
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === "-") return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

/** Profit on a finished job (§13.5 job total − materials); null when unknown. */
export function jobMargin(job: {
  job_total: number | null;
  materials_cost: number | null;
}): number | null {
  if (job.job_total === null) return null;
  return Math.round((job.job_total - (job.materials_cost ?? 0)) * 100) / 100;
}
