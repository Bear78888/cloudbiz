import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isServiceAreaEmpty } from "@/features/profile/model";
import { getBusinessProfile } from "@/features/profile/service";
import type { Locale } from "@/lib/routes";
import { must } from "@/lib/supabase/query";

import {
  siteBlockers,
  type SiteColorPreset,
  type SiteProfileFacts,
  type SiteStatus,
  type SiteTemplate,
  type SiteTextContent,
} from "./model";
import type { SiteContentInput, SiteSettingsInput } from "./schema";
import { buildSnapshot } from "./snapshot";

/**
 * Business Website storage (§19).
 *
 * Reads go through `must()`: a failed query must not be mistaken for "this
 * business has no site", which is how an owner would be shown an empty form
 * over the top of content they had already written.
 */

/** PostgreSQL's unique-violation code, as PostgREST forwards it. */
const UNIQUE_VIOLATION = "23505";

export interface SiteRecord {
  organizationId: string;
  template: SiteTemplate;
  colorPreset: SiteColorPreset;
  status: SiteStatus;
  hiddenBlocks: string[];
  /** The version the public is reading, or null before the first publish. */
  publishedVersionId: string | null;
  updatedAt: string;
}

export interface SiteProfileRecord extends SiteProfileFacts {
  slug: string | null;
  locales: Locale[];
}

function emptyContent(locale: string): SiteTextContent {
  return {
    locale,
    headline: null,
    subheadline: null,
    aboutText: null,
    ctaText: null,
    serviceAreaNote: null,
    whyChooseUs: [],
    faq: [],
    aiGeneratedAt: null,
    reviewedAt: null,
  };
}

/**
 * The site's settings row, or null when the owner has never opened the tool.
 *
 * Nothing creates the row on their behalf: an organization that has not been
 * near the website settings should not acquire a site record as a side effect
 * of, say, the dashboard counting things.
 */
export async function getSite(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SiteRecord | null> {
  const row = await must(
    supabase
      .from("business_sites")
      .select("organization_id, template, color_preset, status, hidden_blocks, published_version_id, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    "website:get-site",
  );
  if (!row) return null;

  return {
    organizationId: row.organization_id as string,
    template: row.template as SiteTemplate,
    colorPreset: row.color_preset as SiteColorPreset,
    status: row.status as SiteStatus,
    hiddenBlocks: (row.hidden_blocks as string[] | null) ?? [],
    publishedVersionId: (row.published_version_id as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

/**
 * The facts the site is built from (§19.10: "the site is created from the
 * business profile").
 *
 * Read through the profile feature's own parsers rather than by picking at the
 * jsonb here. Two readers of an untyped column drift, and the direction this
 * one would drift in is visible: counting `Object.keys(service_area)` called an
 * area "set" when it held `{zipCodes: [], cities: []}` — an empty area that
 * would have switched the Service Area block on with nothing in it, which is
 * the §19.8 failure this whole file is careful about.
 */
export async function getSiteProfile(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SiteProfileRecord | null> {
  const profile = await getBusinessProfile(supabase, organizationId);
  if (!profile) return null;

  return {
    displayName: profile.displayName,
    phone: profile.phone,
    email: profile.email,
    serviceCount: profile.services.length,
    hasServiceArea: !isServiceAreaEmpty(profile.serviceArea),
    googleReviewUrl: profile.googleReviewUrl,
    slug: profile.websiteSlug,
    locales: profile.supportedLocales as Locale[],
  };
}

/** Every language of the site's content that has been written so far. */
export async function listSiteContent(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SiteTextContent[]> {
  const rows = await must(
    supabase
      .from("business_site_texts")
      .select(
        "locale, headline, subheadline, about_text, cta_text, service_area_note, why_choose_us, faq, ai_generated_at, reviewed_at",
      )
      .eq("organization_id", organizationId)
      .order("locale", { ascending: true }),
    "website:list-content",
  );

  return (rows ?? []).map((row) => ({
    locale: row.locale as string,
    headline: (row.headline as string | null) ?? null,
    subheadline: (row.subheadline as string | null) ?? null,
    aboutText: (row.about_text as string | null) ?? null,
    ctaText: (row.cta_text as string | null) ?? null,
    serviceAreaNote: (row.service_area_note as string | null) ?? null,
    // The column is jsonb with an "is an array" constraint, so the type is
    // guaranteed; the entries inside it are not, and a non-string would other-
    // wise reach React as an object and break the page for everyone.
    whyChooseUs: toStringArray(row.why_choose_us),
    faq: toFaqArray(row.faq),
    aiGeneratedAt: (row.ai_generated_at as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
  }));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toFaqArray(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const question = record.question;
    const answer = record.answer;
    if (typeof question !== "string" || typeof answer !== "string") return [];
    return [{ question, answer }];
  });
}

/** The content for one language, or a blank record when it has never been written. */
export function contentFor(rows: readonly SiteTextContent[], locale: string): SiteTextContent {
  return rows.find((row) => row.locale === locale) ?? emptyContent(locale);
}

export type SaveSettingsError = "slug_taken" | "generic";

/**
 * Saves the site's settings, and the two profile fields that belong to them.
 *
 * The address and the languages live on `business_profiles` because they are
 * facts about the business rather than about this one tool — the slug is
 * already unique there and onboarding already writes the locales. Writing them
 * from here keeps one screen in charge of the whole answer instead of sending
 * the owner to a second page to finish a sentence they started on this one.
 *
 * The site row is upserted: the first save is what creates it (see `getSite`).
 */
export async function saveSiteSettings(
  supabase: SupabaseClient,
  organizationId: string,
  input: SiteSettingsInput,
): Promise<{ ok: true } | { ok: false; error: SaveSettingsError }> {
  const { error: profileError } = await supabase
    .from("business_profiles")
    .update({ website_slug: input.slug, supported_locales: input.locales })
    .eq("organization_id", organizationId);

  if (profileError) {
    // The slug is unique across every business on the platform, so "someone
    // else already has this address" is an ordinary outcome of typing a common
    // trade name — not an error to show as a stack trace (§29).
    if (profileError.code === UNIQUE_VIOLATION) return { ok: false, error: "slug_taken" };
    console.error("[website] profile update failed:", profileError.message);
    return { ok: false, error: "generic" };
  }

  const { error: siteError } = await supabase.from("business_sites").upsert(
    {
      organization_id: organizationId,
      template: input.template,
      color_preset: input.colorPreset,
      hidden_blocks: input.hiddenBlocks,
    },
    { onConflict: "organization_id" },
  );

  if (siteError) {
    console.error("[website] site settings update failed:", siteError.message);
    return { ok: false, error: "generic" };
  }

  // Languages the site is no longer offered in stop having a page. Leaving the
  // rows behind would mean a Spanish draft quietly reappearing months later
  // when the owner ticks Spanish again — with whatever it said before, which
  // they will not remember writing.
  const { error: pruneError } = await supabase
    .from("business_site_texts")
    .delete()
    .eq("organization_id", organizationId)
    .not("locale", "in", `(${input.locales.join(",")})`);

  if (pruneError) {
    // The settings are saved; reporting failure now would be false. A stale
    // row for an unticked language is invisible to the public renderer, which
    // reads only the offered locales.
    console.error("[website] could not prune unused locales:", pruneError.message);
  }

  return { ok: true };
}

/**
 * Publishes or withdraws the site (§19.10).
 *
 * The readiness check is re-run here from the database rather than trusted from
 * the page the button was on: that page may be minutes stale, and "publish"
 * writes a page under someone's business name to an address strangers can open.
 *
 * Withdrawing has no such gate. Taking your own site down is never something to
 * argue with.
 */
export type PublishError = "not_found" | "not_ready" | "generic";

export async function setSiteStatus(
  supabase: SupabaseClient,
  organizationId: string,
  next: SiteStatus,
  actorId: string | null = null,
): Promise<{ ok: true } | { ok: false; error: PublishError }> {
  if (next === "draft") return withdrawSite(supabase, organizationId);
  return publishSite(supabase, organizationId, actorId);
}

/**
 * Publishes the current draft as a new version (§19.10).
 *
 * Publishing writes a snapshot and points the site at it. It is deliberately
 * not "flip a status": with the public page reading live rows, every keystroke
 * an owner typed afterwards would be on the internet immediately, and there
 * would be nothing for a rollback to return to.
 *
 * The readiness check runs here, against the database, rather than being
 * trusted from the page the button was on — that page may be minutes stale, and
 * this writes a page under a business's name to an address strangers can open.
 */
export async function publishSite(
  supabase: SupabaseClient,
  organizationId: string,
  actorId: string | null,
): Promise<{ ok: true } | { ok: false; error: PublishError }> {
  const [site, profile, fullProfile, content] = await Promise.all([
    getSite(supabase, organizationId),
    getSiteProfile(supabase, organizationId),
    getBusinessProfile(supabase, organizationId),
    listSiteContent(supabase, organizationId),
  ]);

  // No site row means the owner has never saved their settings. Reporting
  // success would leave them waiting for a page that does not exist.
  if (!site || !profile || !fullProfile || !profile.slug) {
    return { ok: false, error: "not_found" };
  }

  const blockers = siteBlockers({
    slug: profile.slug,
    locales: profile.locales,
    profile,
    content,
  });
  if (blockers.length > 0) return { ok: false, error: "not_ready" };

  const snapshot = buildSnapshot({
    slug: profile.slug,
    site: {
      template: site.template,
      colorPreset: site.colorPreset,
      hiddenBlocks: site.hiddenBlocks,
    },
    profile: {
      displayName: fullProfile.displayName,
      ownerName: fullProfile.ownerName,
      phone: fullProfile.phone,
      email: fullProfile.email,
      services: fullProfile.services,
      serviceArea: fullProfile.serviceArea,
      businessHours: fullProfile.businessHours,
      googleReviewUrl: fullProfile.googleReviewUrl,
      supportedLocales: profile.locales,
    },
    content,
  });

  // The number comes from what exists rather than from a counter held here:
  // two publishes at once must not both claim version 4, and the unique index
  // would reject the second.
  const existing = await must(
    supabase
      .from("business_site_versions")
      .select("version")
      .eq("organization_id", organizationId)
      .order("version", { ascending: false })
      .limit(1),
    "website:last-version",
  );
  const nextVersion = ((existing ?? [])[0]?.version ?? 0) + 1;

  const { data: created, error: versionError } = await supabase
    .from("business_site_versions")
    .insert({
      organization_id: organizationId,
      version: nextVersion,
      snapshot: snapshot as unknown as Record<string, unknown>,
      published_by: actorId,
    })
    .select("id")
    .single();

  if (versionError || !created) {
    console.error("[website] could not write the version:", versionError?.message);
    return { ok: false, error: "generic" };
  }

  const { error } = await supabase
    .from("business_sites")
    .update({ status: "published", published_version_id: created.id })
    .eq("organization_id", organizationId);

  if (error) {
    // The version row survives. It is append-only by design, and an orphan
    // snapshot nobody points at costs a row; the alternative — deleting it — is
    // the one thing this table refuses to do.
    console.error("[website] version written but not published:", error.message);
    return { ok: false, error: "generic" };
  }

  return { ok: true };
}

/**
 * Takes the site down.
 *
 * `published_version_id` is left where it is on purpose: it records what the
 * public last read, which is worth keeping, and nothing serves it while the
 * status is `draft`.
 */
export async function withdrawSite(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: PublishError }> {
  const { data, error } = await supabase
    .from("business_sites")
    .update({ status: "draft" })
    .eq("organization_id", organizationId)
    .select("organization_id");

  if (error) {
    console.error("[website] withdrawal failed:", error.message);
    return { ok: false, error: "generic" };
  }
  if (!data || data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}

export interface SiteVersionSummary {
  id: string;
  version: number;
  publishedAt: string;
  isLive: boolean;
}

export async function listSiteVersions(
  supabase: SupabaseClient,
  organizationId: string,
  publishedVersionId: string | null,
): Promise<SiteVersionSummary[]> {
  const rows = await must(
    supabase
      .from("business_site_versions")
      .select("id, version, published_at")
      .eq("organization_id", organizationId)
      .order("version", { ascending: false })
      .limit(20),
    "website:versions",
  );

  return (rows ?? []).map((row) => ({
    id: row.id as string,
    version: row.version as number,
    publishedAt: row.published_at as string,
    isLive: row.id === publishedVersionId,
  }));
}

/**
 * Rolls back to an earlier version (§19.10).
 *
 * Moves the pointer. Nothing is edited and nothing is deleted — the version
 * being rolled *away from* is exactly what someone may want back ten minutes
 * later, and the table refuses to lose it either way.
 *
 * The version's ownership is re-checked here rather than trusted from the form:
 * an id in a POST is not evidence that it belongs to the organization asking.
 * RLS would refuse to read someone else's, which is what makes the check work.
 */
export async function rollbackSite(
  supabase: SupabaseClient,
  organizationId: string,
  versionId: string,
): Promise<{ ok: true } | { ok: false; error: PublishError }> {
  const target = await must(
    supabase
      .from("business_site_versions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", versionId)
      .maybeSingle(),
    "website:rollback-target",
  );
  if (!target) return { ok: false, error: "not_found" };

  const { data, error } = await supabase
    .from("business_sites")
    .update({ status: "published", published_version_id: versionId })
    .eq("organization_id", organizationId)
    .select("organization_id");

  if (error) {
    console.error("[website] rollback failed:", error.message);
    return { ok: false, error: "generic" };
  }
  if (!data || data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Saves one language of the content.
 *
 * `reviewed_at` is stamped on every human save, which is what §19.5 asks for in
 * the only way that survives contact with reality: the person editing the text
 * has, by definition, just read it. A separate "I confirm this translation"
 * button would be a second step that means the same thing, and the page would
 * still be unpublishable until someone pressed it.
 */
export async function saveSiteContent(
  supabase: SupabaseClient,
  organizationId: string,
  locale: Locale,
  input: SiteContentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("business_site_texts").upsert(
    {
      organization_id: organizationId,
      locale,
      headline: input.headline,
      subheadline: input.subheadline,
      about_text: input.aboutText,
      cta_text: input.ctaText,
      service_area_note: input.serviceAreaNote,
      why_choose_us: input.whyChooseUs,
      faq: input.faq,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,locale" },
  );

  if (error) {
    console.error("[website] content update failed:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}
