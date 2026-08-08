"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { trackServerEvent } from "@/lib/analytics";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ProfileActionState } from "./action-state";
import { DAYS, type Day } from "./model";
import { parseProfileForm } from "./schema";
import { saveBusinessProfile } from "./service";

/**
 * Server action for the business profile (§10.2 steps 3–5).
 *
 * The organization is re-derived from the session rather than read from a form
 * field, so a tampered `organization_id` never reaches a query — and RLS would
 * reject it if it did. The owner check is here as well as in the policy, so a
 * staff member reads a sentence rather than watching a save do nothing.
 */

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "en");
  return isLocale(value) ? value : "en";
}

/** `open_mon` / `close_mon` … collected back into one object per day. */
function readHours(formData: FormData): Partial<Record<Day, { open?: string; close?: string }>> {
  const hours: Partial<Record<Day, { open?: string; close?: string }>> = {};
  for (const day of DAYS) {
    hours[day] = {
      open: String(formData.get(`open_${day}`) ?? ""),
      close: String(formData.get(`close_${day}`) ?? ""),
    };
  }
  return hours;
}

export async function saveProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const locale = localeFrom(formData);

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) redirect(`/${locale}/onboarding`);
  if (membership.role !== "owner") {
    return { errors: {}, formError: "not_owner", saved: false };
  }

  const parsed = parseProfileForm({
    owner_name: String(formData.get("owner_name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    zip_codes: String(formData.get("zip_codes") ?? ""),
    cities: String(formData.get("cities") ?? ""),
    google_review_url: String(formData.get("google_review_url") ?? ""),
    open_days: formData.getAll("open_day").map(String),
    hours: readHours(formData),
    service_name_en: formData.getAll("service_name_en").map(String),
    service_name_es: formData.getAll("service_name_es").map(String),
  });
  if (!parsed.ok) return { errors: parsed.errors, formError: null, saved: false };

  const result = await saveBusinessProfile(supabase, membership.organizationId, parsed.value);
  if (!result.ok) return { errors: {}, formError: "generic", saved: false };

  trackServerEvent("business_profile_completed", {
    organization_id: membership.organizationId,
    services: parsed.value.services.length,
  });

  revalidatePath(`/${locale}/app/settings/business`);
  // The website's readiness list reads straight from these fields, so it is
  // stale the moment they change.
  revalidatePath(`/${locale}/app/settings/website`);
  return { errors: {}, formError: null, saved: true };
}
