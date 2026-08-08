"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { trackServerEvent } from "@/lib/analytics";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { SiteContentActionState, SiteSettingsActionState } from "./action-state";
import { parseSiteContentForm, parseSiteSettingsForm } from "./schema";
import { rollbackSite, saveSiteContent, saveSiteSettings, setSiteStatus } from "./service";
import { translateSiteContent } from "./translate";

/**
 * Server actions for the Business Website (§19).
 *
 * As everywhere else, the organization is re-derived from the session rather
 * than read from a form field, so a tampered `organization_id` never reaches a
 * query — and RLS would reject it if it did.
 *
 * The owner check is here *and* in the RLS policies. The policy is what makes
 * it true; this one makes it say so, because a staff member who reaches this
 * page should read "only the owner can change the website" rather than watch a
 * save fail with nothing to explain it.
 */

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "en");
  return isLocale(value) ? value : "en";
}

/** The language of the *content* being edited, which is not the UI's language. */
function contentLocaleFrom(formData: FormData): Locale {
  const value = String(formData.get("content_locale") ?? "en");
  return isLocale(value) ? value : "en";
}

async function requireContext() {
  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  return { supabase, membership };
}

export async function saveSiteSettingsAction(
  _previous: SiteSettingsActionState,
  formData: FormData,
): Promise<SiteSettingsActionState> {
  const locale = localeFrom(formData);

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);
  if (membership.role !== "owner") {
    return { errors: {}, formError: "not_owner", saved: false };
  }

  const parsed = parseSiteSettingsForm({
    slug: String(formData.get("slug") ?? ""),
    template: String(formData.get("template") ?? ""),
    color_preset: String(formData.get("color_preset") ?? ""),
    locales: formData.getAll("site_locale").map(String),
    visible_blocks: formData.getAll("visible_block").map(String),
  });
  if (!parsed.ok) return { errors: parsed.errors, formError: null, saved: false };

  const result = await saveSiteSettings(supabase, membership.organizationId, parsed.value);
  if (!result.ok) {
    // A taken address is a fact about one field, so it is reported on that
    // field — the owner's next move is to type a different one, and a banner
    // at the top of the form does not point at where to do it.
    if (result.error === "slug_taken") {
      return { errors: { slug: "taken" }, formError: null, saved: false };
    }
    return { errors: {}, formError: "generic", saved: false };
  }

  trackServerEvent("website_settings_saved", { organization_id: membership.organizationId });

  revalidatePath(`/${locale}/app/settings/website`);
  return { errors: {}, formError: null, saved: true };
}

/**
 * Publish or withdraw (§19.10).
 *
 * A plain redirecting action rather than a form-state one: the answer the owner
 * wants is the page reloading with a live address on it, and the reason for a
 * refusal travels in the URL — the settings page is a server component, and a
 * query parameter survives the redirect without inventing a session store for
 * one sentence (same as the estimate actions).
 */
export async function setSiteStatusAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const next = String(formData.get("status") ?? "");

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);

  const target = `/${locale}/app/settings/website`;
  if (membership.role !== "owner") redirect(`${target}?blocked=not_owner`);
  if (next !== "published" && next !== "draft") redirect(target);

  // Who pressed it, recorded on the version. Read from the session, never from
  // the form.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await setSiteStatus(supabase, membership.organizationId, next, user?.id ?? null);

  if (result.ok) {
    trackServerEvent(next === "published" ? "website_published" : "website_unpublished", {
      organization_id: membership.organizationId,
    });
  }

  revalidatePath(target);
  redirect(result.ok ? `${target}?${next === "published" ? "published" : "withdrawn"}=1` : `${target}?blocked=${result.error}`);
}

/**
 * Rolls the live site back to an earlier version (§19.10).
 *
 * Separate from `setSiteStatusAction` because it is a different question — not
 * "should this be public" but "which of the things I published should be". The
 * version id is checked against the organization in the service; an id in a
 * POST is not evidence that it belongs to whoever sent it.
 */
export async function rollbackSiteAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const versionId = String(formData.get("version_id") ?? "").trim();

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);

  const target = `/${locale}/app/settings/website`;
  if (membership.role !== "owner") redirect(`${target}?blocked=not_owner`);
  if (!versionId) redirect(target);

  const result = await rollbackSite(supabase, membership.organizationId, versionId);

  if (result.ok) {
    trackServerEvent("website_rolled_back", { organization_id: membership.organizationId });
  }

  revalidatePath(target);
  redirect(result.ok ? `${target}?restored=1` : `${target}?blocked=${result.error}`);
}

/**
 * Drafts one language from another with the model (§19.5).
 *
 * The result is a draft in the strong sense: it lands with `ai_generated_at`
 * set and nothing marking it reviewed, which is the state `siteBlockers`
 * refuses to publish. A person has to open it, read it and save it — and their
 * save is what counts as confirming the translation.
 */
export async function translateSiteContentAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const targetLocale = contentLocaleFrom(formData);
  const sourceRaw = String(formData.get("source_locale") ?? "");
  const sourceLocale: Locale = isLocale(sourceRaw) ? sourceRaw : "en";

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);

  const target = `/${locale}/app/settings/website?content=${targetLocale}`;
  if (membership.role !== "owner") redirect(`${target}&blocked=not_owner`);

  const result = await translateSiteContent(
    supabase,
    membership.organizationId,
    sourceLocale,
    targetLocale,
  );

  if (result.ok) {
    trackServerEvent("website_translated", {
      organization_id: membership.organizationId,
      source_locale: sourceLocale,
      target_locale: targetLocale,
    });
  }

  revalidatePath(`/${locale}/app/settings/website`);
  redirect(result.ok ? `${target}&translated=1` : `${target}&blocked=${result.error}`);
}

export async function saveSiteContentAction(
  _previous: SiteContentActionState,
  formData: FormData,
): Promise<SiteContentActionState> {
  const locale = localeFrom(formData);
  const contentLocale = contentLocaleFrom(formData);

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);
  if (membership.role !== "owner") {
    return { errors: {}, formError: "not_owner", saved: false };
  }

  const parsed = parseSiteContentForm({
    headline: String(formData.get("headline") ?? ""),
    subheadline: String(formData.get("subheadline") ?? ""),
    about_text: String(formData.get("about_text") ?? ""),
    cta_text: String(formData.get("cta_text") ?? ""),
    service_area_note: String(formData.get("service_area_note") ?? ""),
    why_choose_us: String(formData.get("why_choose_us") ?? ""),
    faq_question: formData.getAll("faq_question").map(String),
    faq_answer: formData.getAll("faq_answer").map(String),
  });
  if (!parsed.ok) return { errors: parsed.errors, formError: null, saved: false };

  const result = await saveSiteContent(
    supabase,
    membership.organizationId,
    contentLocale,
    parsed.value,
  );
  if (!result.ok) return { errors: {}, formError: "generic", saved: false };

  trackServerEvent("website_content_saved", {
    organization_id: membership.organizationId,
    content_locale: contentLocale,
  });

  revalidatePath(`/${locale}/app/settings/website`);
  return { errors: {}, formError: null, saved: true };
}
