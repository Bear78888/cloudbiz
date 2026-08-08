import "server-only";

import {
  parseBusinessHours,
  parseServiceArea,
  parseServices,
} from "@/features/profile/service";
import type { Locale } from "@/lib/routes";
import { must } from "@/lib/supabase/query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { slugProblem, type SiteColorPreset, type SiteTemplate, type SiteTextContent } from "./model";
import { buildRenderableSite, type RenderableSite } from "./render";

/**
 * Reading a published site for a visitor (§19.6, §19.10).
 *
 * The service-role client, for the same reason as the customer's copy of an
 * estimate: `anon` holds no grant on any of these tables and deliberately never
 * will. A grant would mean every *unpublished* draft on the platform was one
 * PostgREST query away from anyone who asked, and §19.10 is explicit that a
 * private draft is not publicly available.
 *
 * The price is that RLS is not helping here, so this module takes a slug and
 * nothing else — no organization id from a caller, ever — and every query is
 * scoped by what the previous one returned.
 */

/** Never rendered publicly, and never selected: kept as an explicit refusal. */
export const FORBIDDEN_PUBLIC_PROFILE_FIELDS = ["notification_settings"] as const;

export interface PublishedSite {
  organizationId: string;
  site: RenderableSite;
  /** Every language this site is offered in, for `hreflang` and the switch. */
  locales: Locale[];
}

/**
 * Looks up a published site by its address.
 *
 * Returns null for anything that is not a published site — a slug nobody has,
 * a draft, a language the site is not offered in. All three are the same answer
 * on purpose: a visitor who can tell "this business exists but is unpublished"
 * apart from "no such business" has learned something the owner did not publish.
 */
export async function getPublishedSite(
  slug: string,
  locale: Locale,
): Promise<PublishedSite | null> {
  // The shape check runs first, so a scanner throwing paths at the route never
  // reaches the database.
  if (slugProblem(slug) !== null) return null;

  const supabase = createSupabaseAdminClient();

  const profileRow = await must(
    supabase
      .from("business_profiles")
      .select(
        "organization_id, display_name, owner_name, phone, email, services, service_area, business_hours, google_review_url, supported_locales, website_slug",
      )
      .eq("website_slug", slug)
      .maybeSingle(),
    "public-site:profile",
  );
  if (!profileRow) return null;

  const locales = ((profileRow.supported_locales as string[] | null) ?? ["en"]).filter(
    (candidate): candidate is Locale => candidate === "en" || candidate === "es",
  );
  if (!locales.includes(locale)) return null;

  const organizationId = profileRow.organization_id as string;

  const siteRow = await must(
    supabase
      .from("business_sites")
      .select("template, color_preset, status, hidden_blocks")
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .maybeSingle(),
    "public-site:site",
  );
  if (!siteRow) return null;

  const contentRow = await must(
    supabase
      .from("business_site_texts")
      .select(
        "locale, headline, subheadline, about_text, cta_text, service_area_note, why_choose_us, faq, ai_generated_at, reviewed_at",
      )
      .eq("organization_id", organizationId)
      .eq("locale", locale)
      .maybeSingle(),
    "public-site:content",
  );

  const content: SiteTextContent | null = contentRow
    ? {
        locale,
        headline: (contentRow.headline as string | null) ?? null,
        subheadline: (contentRow.subheadline as string | null) ?? null,
        aboutText: (contentRow.about_text as string | null) ?? null,
        ctaText: (contentRow.cta_text as string | null) ?? null,
        serviceAreaNote: (contentRow.service_area_note as string | null) ?? null,
        whyChooseUs: toStrings(contentRow.why_choose_us),
        faq: toFaq(contentRow.faq),
        aiGeneratedAt: (contentRow.ai_generated_at as string | null) ?? null,
        reviewedAt: (contentRow.reviewed_at as string | null) ?? null,
      }
    : null;

  return {
    organizationId,
    locales,
    site: buildRenderableSite({
      locale,
      slug,
      site: {
        template: siteRow.template as SiteTemplate,
        colorPreset: siteRow.color_preset as SiteColorPreset,
        hiddenBlocks: (siteRow.hidden_blocks as string[] | null) ?? [],
      },
      profile: {
        displayName: profileRow.display_name as string,
        ownerName: (profileRow.owner_name as string | null) ?? null,
        phone: (profileRow.phone as string | null) ?? null,
        email: (profileRow.email as string | null) ?? null,
        services: parseServices(profileRow.services),
        serviceArea: parseServiceArea(profileRow.service_area),
        businessHours: parseBusinessHours(profileRow.business_hours),
        googleReviewUrl: (profileRow.google_review_url as string | null) ?? null,
        supportedLocales: locales,
      },
      content,
    }),
  };
}

/** The first language a site is offered in — where `/pro/{slug}` sends a visitor. */
export async function defaultLocaleForSite(slug: string): Promise<Locale | null> {
  if (slugProblem(slug) !== null) return null;

  const supabase = createSupabaseAdminClient();
  const row = await must(
    supabase
      .from("business_profiles")
      .select("organization_id, supported_locales")
      .eq("website_slug", slug)
      .maybeSingle(),
    "public-site:default-locale",
  );
  if (!row) return null;

  // Unpublished sites get no redirect either: following one to a 404 would
  // still confirm the business exists.
  const published = await must(
    supabase
      .from("business_sites")
      .select("organization_id")
      .eq("organization_id", row.organization_id as string)
      .eq("status", "published")
      .maybeSingle(),
    "public-site:default-locale-status",
  );
  if (!published) return null;

  const locales = ((row.supported_locales as string[] | null) ?? ["en"]).filter(
    (candidate): candidate is Locale => candidate === "en" || candidate === "es",
  );
  return locales[0] ?? null;
}

function toStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toFaq(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.question !== "string" || typeof record.answer !== "string") return [];
    return [{ question: record.question, answer: record.answer }];
  });
}
