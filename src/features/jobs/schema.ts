/**
 * Job form validation (§13.5) — pure, framework-free, so the same rules cover
 * the UI form, the server action and the CSV import.
 *
 * Errors are returned as *codes*, never as sentences: the caller looks them up
 * in the dictionary of the current locale (§9.2). Nothing here formats a
 * message or touches the database.
 */

import {
  CUSTOMER_LOCALES,
  JOB_PRIORITIES,
  JOB_STATUSES,
  LEAD_SOURCES,
  PAYMENT_STATUSES,
  parseMoney,
  type CustomerLocale,
  type JobPriority,
  type JobStatus,
  type LeadSource,
  type PaymentStatus,
} from "./model";
import { zonedInputToIso } from "@/lib/datetime";

export type FieldErrorCode =
  | "required"
  | "too_long"
  | "invalid_email"
  | "invalid_amount"
  | "invalid_date"
  | "invalid_choice"
  | "schedule_order";

export type JobFormField =
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "customer_locale"
  | "title"
  | "service"
  | "description"
  | "status"
  | "priority"
  | "source"
  | "address"
  | "scheduled_start"
  | "scheduled_end"
  | "estimate_amount"
  | "job_total"
  | "materials_cost"
  | "payment_status"
  | "assigned_user_id"
  | "notes";

export type JobFormErrors = Partial<Record<JobFormField, FieldErrorCode>>;

export interface CustomerInput {
  name: string;
  phone: string | null;
  email: string | null;
  preferred_locale: CustomerLocale;
  address: string | null;
  sms_consent: boolean;
}

export interface JobFieldsInput {
  title: string;
  service: string | null;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  source: LeadSource | null;
  address: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimate_amount: number | null;
  job_total: number | null;
  materials_cost: number | null;
  payment_status: PaymentStatus;
  assigned_user_id: string | null;
  notes: string | null;
}

export interface JobFormInput {
  customer: CustomerInput;
  job: JobFieldsInput;
}

export type JobFormResult =
  | { ok: true; value: JobFormInput }
  | { ok: false; errors: JobFormErrors };

export type RawForm = Record<string, string | undefined>;

const MAX_SHORT = 200;
const MAX_LONG = 5000;

/** Deliberately permissive: `a@b.c`. Deliverability is the mail provider's job. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function optionalText(raw: string | undefined): string | null {
  const value = text(raw);
  return value === "" ? null : value;
}

function inRegistry<T extends string>(value: string, registry: readonly T[]): value is T {
  return (registry as readonly string[]).includes(value);
}

/**
 * Validates a raw form submission. `timeZone` is the organization's (§25.1):
 * schedule fields arrive as wall-clock strings and are stored as instants.
 */
export function parseJobForm(raw: RawForm, timeZone: string): JobFormResult {
  const errors: JobFormErrors = {};

  const customerName = text(raw.customer_name);
  if (customerName === "") errors.customer_name = "required";
  else if (customerName.length > MAX_SHORT) errors.customer_name = "too_long";

  const customerEmail = optionalText(raw.customer_email);
  if (customerEmail && !EMAIL_SHAPE.test(customerEmail)) errors.customer_email = "invalid_email";
  else if (customerEmail && customerEmail.length > MAX_SHORT) errors.customer_email = "too_long";

  const customerPhone = optionalText(raw.customer_phone);
  if (customerPhone && customerPhone.length > 40) errors.customer_phone = "too_long";

  const customerLocaleRaw = text(raw.customer_locale) || "en";
  if (!inRegistry(customerLocaleRaw, CUSTOMER_LOCALES)) errors.customer_locale = "invalid_choice";

  const title = text(raw.title);
  if (title === "") errors.title = "required";
  else if (title.length > MAX_SHORT) errors.title = "too_long";

  const service = optionalText(raw.service);
  if (service && service.length > MAX_SHORT) errors.service = "too_long";

  const description = optionalText(raw.description);
  if (description && description.length > MAX_LONG) errors.description = "too_long";

  const notes = optionalText(raw.notes);
  if (notes && notes.length > MAX_LONG) errors.notes = "too_long";

  const address = optionalText(raw.address);
  if (address && address.length > MAX_SHORT * 2) errors.address = "too_long";

  const statusRaw = text(raw.status) || "new_lead";
  if (!inRegistry(statusRaw, JOB_STATUSES)) errors.status = "invalid_choice";

  const priorityRaw = text(raw.priority) || "normal";
  if (!inRegistry(priorityRaw, JOB_PRIORITIES)) errors.priority = "invalid_choice";

  const paymentRaw = text(raw.payment_status) || "unpaid";
  if (!inRegistry(paymentRaw, PAYMENT_STATUSES)) errors.payment_status = "invalid_choice";

  const sourceRaw = optionalText(raw.source);
  if (sourceRaw !== null && !inRegistry(sourceRaw, LEAD_SOURCES)) errors.source = "invalid_choice";

  // The form only ever offers real member ids; the shape check keeps a
  // hand-crafted POST from reaching the database with something else.
  const assignedRaw = optionalText(raw.assigned_user_id);
  if (assignedRaw !== null && !UUID_SHAPE.test(assignedRaw)) {
    errors.assigned_user_id = "invalid_choice";
  }

  const amounts = (["estimate_amount", "job_total", "materials_cost"] as const).map((field) => {
    const parsed = parseMoney(raw[field]);
    if (parsed === undefined) errors[field] = "invalid_amount";
    return parsed ?? null;
  });

  const startRawValue = optionalText(raw.scheduled_start);
  const endRawValue = optionalText(raw.scheduled_end);
  const scheduledStart = startRawValue ? zonedInputToIso(startRawValue, timeZone) : null;
  const scheduledEnd = endRawValue ? zonedInputToIso(endRawValue, timeZone) : null;
  if (startRawValue && scheduledStart === null) errors.scheduled_start = "invalid_date";
  if (endRawValue && scheduledEnd === null) errors.scheduled_end = "invalid_date";
  if (
    scheduledStart &&
    scheduledEnd &&
    new Date(scheduledEnd).getTime() < new Date(scheduledStart).getTime()
  ) {
    errors.scheduled_end = "schedule_order";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        preferred_locale: customerLocaleRaw as CustomerLocale,
        address,
        // §17.9: consent is only ever an explicit opt-in.
        sms_consent: text(raw.sms_consent) === "on" || text(raw.sms_consent) === "true",
      },
      job: {
        title,
        service,
        description,
        status: statusRaw as JobStatus,
        priority: priorityRaw as JobPriority,
        source: sourceRaw as LeadSource | null,
        address,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        estimate_amount: amounts[0],
        job_total: amounts[1],
        materials_cost: amounts[2],
        payment_status: paymentRaw as PaymentStatus,
        assigned_user_id: assignedRaw,
        notes,
      },
    },
  };
}
