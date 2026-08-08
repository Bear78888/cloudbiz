/**
 * Business profile form parsing (§10.2 steps 3–5) — pure, so the rules are
 * decided by tests rather than by clicking through a form.
 *
 * Errors are codes, never sentences: the caller looks them up in the dictionary
 * of the current locale (§9.2).
 */

import {
  DAYS,
  isGoogleReviewUrl,
  isUsablePhone,
  isValidDayHours,
  normalizeZip,
  type BusinessHours,
  type BusinessService,
  type Day,
  type DayHours,
  type ServiceArea,
} from "./model";

export type ProfileFieldErrorCode =
  | "required"
  | "too_long"
  | "too_many"
  | "invalid_email"
  | "invalid_phone"
  | "invalid_zip"
  | "invalid_hours"
  | "invalid_url";

export type ProfileField =
  | "owner_name"
  | "phone"
  | "email"
  | "zip_codes"
  | "cities"
  | "hours"
  | "services"
  | "google_review_url";

export type ProfileErrors = Partial<Record<ProfileField, ProfileFieldErrorCode>>;

export const MAX_NAME = 120;
export const MAX_SERVICES = 24;
export const MAX_SERVICE_NAME = 80;
export const MAX_ZIPS = 60;
export const MAX_CITIES = 40;
export const MAX_CITY_NAME = 80;

export interface ProfileInput {
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  serviceArea: ServiceArea;
  businessHours: BusinessHours;
  services: BusinessService[];
  googleReviewUrl: string | null;
}

export type ProfileResult =
  | { ok: true; value: ProfileInput }
  | { ok: false; errors: ProfileErrors };

function text(raw: string | undefined | null): string {
  return (raw ?? "").trim();
}

function optionalText(raw: string | undefined | null): string | null {
  const value = text(raw);
  return value === "" ? null : value;
}

/**
 * A list typed into one box: commas or newlines, whichever the person used.
 *
 * Both, because a ZIP list gets pasted from a spreadsheet as one per line and
 * typed by hand as "78701, 78702" — insisting on one of those would be a rule
 * invented by the form.
 */
function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/**
 * An address, checked loosely on purpose.
 *
 * Exactly one `@`, something either side, a dot in the domain. Deliberately not
 * an RFC-shaped regular expression: those reject real addresses, and the only
 * thing that proves an address works is sending to it.
 */
function isEmailish(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value);
}

export interface RawProfileForm {
  owner_name?: string;
  phone?: string;
  email?: string;
  zip_codes?: string;
  cities?: string;
  google_review_url?: string;
  /** One entry per day the business is open, e.g. `["mon", "tue"]`. */
  open_days?: string[];
  /** Keyed by day, as the form posts them (`open_mon`, `close_mon`). */
  hours?: Partial<Record<Day, { open?: string; close?: string }>>;
  service_name_en?: string[];
  service_name_es?: string[];
}

/**
 * Validates the profile.
 *
 * Almost everything is optional: this is a screen an owner fills in over
 * several sittings, and refusing to save a half-finished profile would mean
 * losing the finished half. What is checked is whether a value that *is* there
 * can do its job — a phone number that cannot be dialled, an address that
 * cannot be mailed, a review link that does not point at Google.
 */
export function parseProfileForm(raw: RawProfileForm): ProfileResult {
  const errors: ProfileErrors = {};

  const ownerName = optionalText(raw.owner_name);
  if (ownerName && ownerName.length > MAX_NAME) errors.owner_name = "too_long";

  const phone = optionalText(raw.phone);
  if (phone && !isUsablePhone(phone)) errors.phone = "invalid_phone";

  const email = optionalText(raw.email);
  if (email && !isEmailish(email)) errors.email = "invalid_email";

  const googleReviewUrl = optionalText(raw.google_review_url);
  if (googleReviewUrl && !isGoogleReviewUrl(googleReviewUrl)) {
    errors.google_review_url = "invalid_url";
  }

  const zipEntries = splitList(raw.zip_codes);
  const zipCodes: string[] = [];
  for (const entry of zipEntries) {
    const zip = normalizeZip(entry);
    if (zip === null) {
      errors.zip_codes = "invalid_zip";
      continue;
    }
    if (!zipCodes.includes(zip)) zipCodes.push(zip);
  }
  if (zipCodes.length > MAX_ZIPS) errors.zip_codes = "too_many";

  const cities: string[] = [];
  for (const entry of splitList(raw.cities)) {
    if (entry.length > MAX_CITY_NAME) {
      errors.cities = "too_long";
      continue;
    }
    if (!cities.includes(entry)) cities.push(entry);
  }
  if (cities.length > MAX_CITIES) errors.cities = "too_many";

  // Hours are read from the days that are ticked, not from whichever time
  // inputs happen to carry a value: unticking Sunday has to close Sunday, and
  // the browser still posts the times sitting in its two boxes.
  //
  // With *nothing* ticked the answer is not "closed seven days a week" — it is
  // "nobody has filled this in", and the difference is a public website that
  // either says nothing about hours or announces that the business never opens.
  // The first version of this wrote seven nulls and the site duly printed seven
  // Closed rows; it was caught by the rendered page in an e2e test, which is
  // the only place it was visible.
  const openDays = new Set(raw.open_days ?? []);
  const businessHours: BusinessHours = {};
  for (const day of openDays.size === 0 ? [] : DAYS) {
    if (!openDays.has(day)) {
      businessHours[day] = null;
      continue;
    }
    const entry = raw.hours?.[day];
    const hours: DayHours = { open: text(entry?.open), close: text(entry?.close) };
    if (!isValidDayHours(hours)) {
      errors.hours = "invalid_hours";
      continue;
    }
    businessHours[day] = hours;
  }

  // Service rows arrive as parallel arrays, one entry per row. Read by index so
  // a row whose English name was cleared cannot inherit the next row's.
  const namesEn = raw.service_name_en ?? [];
  const namesEs = raw.service_name_es ?? [];
  const services: BusinessService[] = [];
  const rowCount = Math.max(namesEn.length, namesEs.length);
  for (let index = 0; index < rowCount; index += 1) {
    const en = text(namesEn[index]);
    const es = text(namesEs[index]);
    if (en === "" && es === "") continue;
    if (en.length > MAX_SERVICE_NAME || es.length > MAX_SERVICE_NAME) {
      errors.services ??= "too_long";
      continue;
    }
    const name: BusinessService["name"] = {};
    if (en !== "") name.en = en;
    if (es !== "") name.es = es;
    services.push({ name });
  }
  if (services.length > MAX_SERVICES) errors.services = "too_many";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      ownerName,
      phone,
      email,
      serviceArea: { zipCodes, cities },
      businessHours,
      services,
      googleReviewUrl,
    },
  };
}
