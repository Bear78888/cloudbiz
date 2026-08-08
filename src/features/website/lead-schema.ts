/**
 * The website lead form (§19.7) — parsing and validation, pure.
 *
 * This is the only form on the platform a stranger can submit, so the rules are
 * stricter than the owner-facing ones in two ways: everything is length-capped
 * (a form nobody is signed in to is a form somebody will paste a megabyte
 * into), and the consent box is genuinely required rather than merely present.
 *
 * Errors are codes, never sentences: the caller looks them up in the dictionary
 * of the page's language (§9.2).
 */

import { LOCALES, type Locale } from "@/lib/routes";

export type LeadFieldErrorCode = "required" | "too_long" | "invalid_email" | "invalid_phone";

export type LeadField =
  | "name"
  | "phone"
  | "email"
  | "service"
  | "zip"
  | "description"
  | "preferred_date"
  | "consent";

export type LeadErrors = Partial<Record<LeadField, LeadFieldErrorCode>>;

export const MAX_LEAD_NAME = 120;
export const MAX_LEAD_SERVICE = 120;
export const MAX_LEAD_DESCRIPTION = 2000;
export const MAX_LEAD_CONTACT = 160;

export interface LeadInput {
  name: string;
  phone: string | null;
  email: string | null;
  preferredLocale: Locale;
  service: string | null;
  zip: string | null;
  description: string | null;
  /** As typed, `YYYY-MM-DD`, or null. Never a scheduled appointment — see below. */
  preferredDate: string | null;
}

export type LeadResult = { ok: true; value: LeadInput } | { ok: false; errors: LeadErrors };

export interface RawLeadForm {
  name?: string;
  phone?: string;
  email?: string;
  preferred_locale?: string;
  service?: string;
  zip?: string;
  description?: string;
  preferred_date?: string;
  consent?: string;
  /** Hidden, must stay empty. See `parseLeadForm`. */
  website?: string;
}

function text(raw: string | undefined | null): string {
  return (raw ?? "").trim();
}

function optionalText(raw: string | undefined | null): string | null {
  const value = text(raw);
  return value === "" ? null : value;
}

function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value);
}

/** Digits only, so "(512) 555-0134" and "5125550134" are the same number. */
export function leadPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * A honeypot: a field a person never sees and a bot fills in anyway.
 *
 * Silently discarding is the point — a bot told "you failed the check" learns
 * to pass it next time. The caller treats this as a successful submission that
 * created nothing.
 */
export function looksAutomated(raw: RawLeadForm): boolean {
  return text(raw.website) !== "";
}

/**
 * Validates a submission.
 *
 * A name and *some* way to reply are the only hard requirements. Everything
 * else is optional because a lead that arrives half-filled is still a lead, and
 * refusing it to get a tidier record loses the customer, which is the opposite
 * of what the page is for.
 */
export function parseLeadForm(raw: RawLeadForm): LeadResult {
  const errors: LeadErrors = {};

  const name = text(raw.name);
  if (name === "") errors.name = "required";
  else if (name.length > MAX_LEAD_NAME) errors.name = "too_long";

  const phone = optionalText(raw.phone);
  if (phone && phone.length > MAX_LEAD_CONTACT) errors.phone = "too_long";
  // Loose on purpose: this is a customer typing on a phone, not a validated
  // A2P number. Seven digits is enough to be a phone and enough to reject "no".
  else if (phone && leadPhoneDigits(phone).length < 7) errors.phone = "invalid_phone";

  const email = optionalText(raw.email);
  if (email && email.length > MAX_LEAD_CONTACT) errors.email = "too_long";
  else if (email && !isEmailish(email)) errors.email = "invalid_email";

  // One of the two, or the owner has a lead they cannot answer.
  if (!phone && !email && !errors.phone && !errors.email) errors.phone = "required";

  const service = optionalText(raw.service);
  if (service && service.length > MAX_LEAD_SERVICE) errors.service = "too_long";

  const zip = optionalText(raw.zip);
  if (zip && zip.length > 16) errors.zip = "too_long";

  const description = optionalText(raw.description);
  if (description && description.length > MAX_LEAD_DESCRIPTION) errors.description = "too_long";

  const preferredDateRaw = optionalText(raw.preferred_date);
  const preferredDate =
    preferredDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(preferredDateRaw) ? preferredDateRaw : null;

  // §19.7 lists a consent checkbox, and an unticked box is a refusal. This is
  // consent to be contacted about this enquiry — it is NOT the TCPA SMS consent
  // (§17.9), which this form never collects and never sets.
  if (text(raw.consent) === "") errors.consent = "required";

  const localeRaw = text(raw.preferred_locale);
  const preferredLocale: Locale = LOCALES.includes(localeRaw as Locale)
    ? (localeRaw as Locale)
    : "en";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { name, phone, email, preferredLocale, service, zip, description, preferredDate },
  };
}

/**
 * What the owner reads in the job's description.
 *
 * The preferred date goes here rather than into `scheduled_start`, and that is
 * deliberate: a date a stranger typed is a request, not an appointment, and
 * writing it to the schedule would put unconfirmed jobs on the owner's calendar
 * and into the "this week" dashboard count.
 */
export function leadDescription(
  input: LeadInput,
  labels: { preferredDate: string; zip: string },
): string {
  const parts: string[] = [];
  if (input.description) parts.push(input.description);
  if (input.preferredDate) parts.push(`${labels.preferredDate}: ${input.preferredDate}`);
  if (input.zip) parts.push(`${labels.zip}: ${input.zip}`);
  return parts.join("\n\n");
}
