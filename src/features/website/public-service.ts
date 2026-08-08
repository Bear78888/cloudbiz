import "server-only";

import type { Locale } from "@/lib/routes";
import { must } from "@/lib/supabase/query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { slugProblem } from "./model";
import type { RenderableSite } from "./render";
import { parseSnapshot, renderableFromSnapshot, type SiteSnapshot } from "./snapshot";

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

export interface PublishedVersion {
  organizationId: string;
  snapshot: SiteSnapshot;
  /** Which published version the visitor is reading. */
  version: number;
  /** When it was published — `lastmod` in the sitemap (§19.8). */
  publishedAt: string;
}

export interface PublishedSite {
  organizationId: string;
  site: RenderableSite;
  version: number;
  publishedAt: string;
  /** Every language this site is offered in, for `hreflang` and the switch. */
  locales: Locale[];
}

/**
 * The published version behind an address, or null if there is not one.
 *
 * Every public read starts here — the page, the bare-slug redirect and the
 * sitemap — so that "what counts as published" is decided once. It answers null
 * for anything that is not a published site: a slug nobody has, a draft, a
 * business whose site was taken down. All of them are the same answer on
 * purpose, because a visitor who can tell "this business exists but is
 * unpublished" apart from "no such business" has learned something the owner
 * did not publish.
 */
async function readPublishedVersion(slug: string): Promise<PublishedVersion | null> {
  // The shape check runs first, so a scanner throwing paths at the route never
  // reaches the database.
  if (slugProblem(slug) !== null) return null;

  const supabase = createSupabaseAdminClient();

  // The address is a live fact — it is unique across the platform and the owner
  // may change it — so the lookup starts there and everything after it comes
  // out of the published snapshot.
  const profileRow = await must(
    supabase
      .from("business_profiles")
      .select("organization_id")
      .eq("website_slug", slug)
      .maybeSingle(),
    "public-site:slug",
  );
  if (!profileRow) return null;

  const organizationId = profileRow.organization_id as string;

  const siteRow = await must(
    supabase
      .from("business_sites")
      .select("published_version_id")
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .maybeSingle(),
    "public-site:site",
  );
  if (!siteRow?.published_version_id) return null;

  const versionRow = await must(
    supabase
      .from("business_site_versions")
      .select("snapshot, version, published_at")
      .eq("organization_id", organizationId)
      .eq("id", siteRow.published_version_id as string)
      .maybeSingle(),
    "public-site:version",
  );
  if (!versionRow) return null;

  const snapshot = parseSnapshot(versionRow.snapshot);
  if (!snapshot) return null;

  return {
    organizationId,
    snapshot,
    version: versionRow.version as number,
    publishedAt: versionRow.published_at as string,
  };
}

/**
 * Looks up one language of a published site by its address.
 *
 * A language the site is not offered in is the same 404 as an unknown slug,
 * for the reason given on `readPublishedVersion`.
 */
export async function getPublishedSite(
  slug: string,
  locale: Locale,
): Promise<PublishedSite | null> {
  const published = await readPublishedVersion(slug);
  if (!published) return null;

  const site = renderableFromSnapshot(published.snapshot, locale, slug);
  if (!site) return null;

  return {
    organizationId: published.organizationId,
    version: published.version,
    publishedAt: published.publishedAt,
    locales: published.snapshot.profile.supportedLocales,
    site,
  };
}

/**
 * Every language a published site is offered in, and when it was published.
 *
 * What the sitemap needs and nothing more: it lists addresses, so it never
 * renders a page and never needs a snapshot parsed into one.
 */
export async function publishedSiteIndex(
  slug: string,
): Promise<{ locales: Locale[]; publishedAt: string } | null> {
  const published = await readPublishedVersion(slug);
  if (!published) return null;
  return {
    locales: published.snapshot.profile.supportedLocales,
    publishedAt: published.publishedAt,
  };
}

/**
 * The first language a site is offered in — where `/pro/{slug}` sends a visitor.
 *
 * Read from the published version, not the draft: the languages the site is
 * offered in are part of what was published, and an unpublished site gets no
 * redirect either — following one to a 404 would still confirm it exists.
 */
export async function defaultLocaleForSite(slug: string): Promise<Locale | null> {
  const published = await readPublishedVersion(slug);
  return published?.snapshot.profile.supportedLocales[0] ?? null;
}

/**
 * The organization behind a published address, and nothing else.
 *
 * Used by the lead form (§19.7): the submission says which *page* it came from,
 * never which business it is for, so this is the only thing that decides whose
 * job list a stranger's enquiry lands in. An unpublished or unknown slug
 * resolves to null and the enquiry is refused — a form posted at a site that is
 * not public must not write into that business's tracker.
 */
export async function organizationForPublishedSlug(slug: string): Promise<string | null> {
  if (slugProblem(slug) !== null) return null;

  const supabase = createSupabaseAdminClient();

  const profileRow = await must(
    supabase
      .from("business_profiles")
      .select("organization_id")
      .eq("website_slug", slug)
      .maybeSingle(),
    "public-site:lead-organization",
  );
  if (!profileRow) return null;

  const organizationId = profileRow.organization_id as string;

  const siteRow = await must(
    supabase
      .from("business_sites")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .maybeSingle(),
    "public-site:lead-published",
  );
  return siteRow ? organizationId : null;
}
