import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { must } from "@/lib/supabase/query";

import {
  DAYS,
  EMPTY_SERVICE_AREA,
  hasServiceName,
  isValidDayHours,
  type BusinessHours,
  type BusinessService,
  type Day,
  type ServiceArea,
} from "./model";
import type { ProfileInput } from "./schema";

/**
 * Business profile storage (§10.2, §25.1).
 *
 * The jsonb columns have been on `business_profiles` since the platform
 * foundation with nothing writing them, so anything already in the database is
 * of unknown shape. Every read here is defensive for that reason: a malformed
 * value is dropped rather than handed to a page, because these fields end up on
 * a public website (§19) where one bad entry would break the render for every
 * visitor.
 */

export interface BusinessProfile {
  displayName: string;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  services: BusinessService[];
  serviceArea: ServiceArea;
  businessHours: BusinessHours;
  googleReviewUrl: string | null;
  websiteSlug: string | null;
  supportedLocales: string[];
}

/** The columns every reader of the profile needs. Named once, so they agree. */
export const PROFILE_SELECT =
  "display_name, owner_name, phone, email, services, service_area, business_hours, google_review_url, website_slug, supported_locales";

export function parseServices(value: unknown): BusinessService[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const name = (entry as Record<string, unknown>).name;
    if (name === null || typeof name !== "object") return [];
    const record = name as Record<string, unknown>;
    const service: BusinessService = { name: {} };
    if (typeof record.en === "string" && record.en.trim() !== "") service.name.en = record.en;
    if (typeof record.es === "string" && record.es.trim() !== "") service.name.es = record.es;
    return hasServiceName(service) ? [service] : [];
  });
}

export function parseServiceArea(value: unknown): ServiceArea {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_SERVICE_AREA;
  }
  const record = value as Record<string, unknown>;
  const strings = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      : [];
  return { zipCodes: strings(record.zipCodes), cities: strings(record.cities) };
}

export function parseBusinessHours(value: unknown): BusinessHours {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const hours: BusinessHours = {};
  for (const day of DAYS) {
    if (!(day in record)) continue;
    const entry = record[day];
    if (entry === null) {
      hours[day] = null;
      continue;
    }
    if (typeof entry !== "object") continue;
    const shape = entry as Record<string, unknown>;
    if (typeof shape.open !== "string" || typeof shape.close !== "string") continue;
    const candidate = { open: shape.open, close: shape.close };
    // A stored range that no longer validates is treated as "not filled in"
    // rather than printed: the site would otherwise advertise "9:00–8:00".
    if (isValidDayHours(candidate)) hours[day] = candidate;
  }
  return hours;
}

export async function getBusinessProfile(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<BusinessProfile | null> {
  const row = await must(
    supabase
      .from("business_profiles")
      .select(PROFILE_SELECT)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    "profile:get",
  );
  if (!row) return null;

  return {
    displayName: row.display_name as string,
    ownerName: (row.owner_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    services: parseServices(row.services),
    serviceArea: parseServiceArea(row.service_area),
    businessHours: parseBusinessHours(row.business_hours),
    googleReviewUrl: (row.google_review_url as string | null) ?? null,
    websiteSlug: (row.website_slug as string | null) ?? null,
    supportedLocales: (row.supported_locales as string[] | null) ?? ["en"],
  };
}

/**
 * Saves the profile.
 *
 * `website_slug` and `supported_locales` are deliberately not touched: they are
 * owned by the website screen (§19.3), and a save here that carried stale
 * copies of them would quietly change the site's address because someone edited
 * their opening hours.
 */
export async function saveBusinessProfile(
  supabase: SupabaseClient,
  organizationId: string,
  input: ProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("business_profiles")
    .update({
      owner_name: input.ownerName,
      phone: input.phone,
      email: input.email,
      services: input.services,
      service_area: input.serviceArea,
      business_hours: input.businessHours,
      google_review_url: input.googleReviewUrl,
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[profile] update failed:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

/** Days in week order, with the ones that have hours. Used by the site's footer. */
export function openDays(hours: BusinessHours): { day: Day; open: string; close: string }[] {
  return DAYS.flatMap((day) => {
    const entry = hours[day];
    return entry ? [{ day, open: entry.open, close: entry.close }] : [];
  });
}
