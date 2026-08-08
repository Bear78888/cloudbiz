/**
 * What search engines are told about a published site (§19.8).
 *
 * Pure, and that is the point: everything here is a restatement of facts that
 * are already on the page, in a second format. §19.8 forbids invented reviews,
 * invented licences and invented service areas, and structured data is where
 * that rule is easiest to break — nobody reads JSON-LD, so a fabricated
 * `aggregateRating` or a made-up `address` would sit there indefinitely and
 * still be repeated by Google under the business's own name.
 *
 * So the rule this file follows is stricter than "don't invent": **nothing goes
 * into the markup that the visitor cannot also see on the page.** A block the
 * owner switched off contributes nothing, because a machine-readable claim the
 * human page does not make is exactly the kind of divergence that is nobody's
 * job to notice.
 *
 * Two things are deliberately absent, and both are the sort of thing a rich
 * result likes to have:
 *
 *  - `address` — a street address is not collected anywhere on this platform,
 *    and a `PostalAddress` assembled from a ZIP code the owner gave as a
 *    *service area* would be a claim about where they are, not where they work.
 *  - `aggregateRating` / `review` — §19.8's first named prohibition. The only
 *    honest thing held about reviews is a link to where the real ones live, and
 *    a link is not a rating.
 */

import { DAYS, type Day } from "@/features/profile/model";
import { LOCALE_TAGS } from "@/lib/routes";

import type { SiteBlock } from "./model";
import type { RenderableSite } from "./render";

/** `schema.org` day names, in the order `DAYS` uses. */
const SCHEMA_DAYS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/**
 * The sentence that follows the business's name in a search result.
 *
 * The owner's own words, never generated — a meta description is copy, and
 * copy about a licensed trade is not something to compose on their behalf. The
 * subheadline first because it was written to be a summary; the opening of the
 * About text when there is no subheadline; nothing at all when there is
 * neither, which lets the engine quote the page instead of us guessing.
 */
export function siteDescription(site: RenderableSite): string | undefined {
  const subheadline = site.subheadline?.trim();
  if (subheadline) return subheadline;
  const about = site.aboutText?.trim();
  if (!about) return undefined;
  return about.length > 160 ? `${about.slice(0, 157).trimEnd()}…` : about;
}

/**
 * The page as `LocalBusiness` structured data (§19.8).
 *
 * `LocalBusiness` rather than one of the trade-specific subtypes
 * (`Plumber`, `Electrician`, `HVACBusiness`): those types are read as a claim
 * about what the business is licensed to do, and the platform holds a trade
 * the owner picked from a list, not a licence anyone verified.
 *
 * Every field is gated on the block that renders it being visible, so the
 * markup and the page always agree.
 */
export function buildLocalBusinessJsonLd(
  site: RenderableSite,
  /** The page's own canonical address, or null when the deployment has no URL. */
  canonicalUrl: string | null,
): Record<string, unknown> {
  const has = (block: SiteBlock) => site.blocks.includes(block);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.businessName,
  };

  if (canonicalUrl) jsonLd.url = canonicalUrl;

  const description = siteDescription(site);
  if (description) jsonLd.description = description;

  // The contact block is what puts these in front of a person; with it hidden
  // the page does not offer them and neither does the markup.
  if (has("contact_form") || has("call_button")) {
    if (site.phone) jsonLd.telephone = site.phone;
    if (site.email) jsonLd.email = site.email;
  }

  if (has("service_area")) {
    const areaServed = [
      // A named city is a place; a ZIP code the owner typed is a string, and
      // dressing it up as a `PostalCodeSpecification` would assert a postal
      // geography we did not look up.
      ...site.serviceArea.cities.map((city) => ({ "@type": "City", name: city })),
      ...site.serviceArea.zipCodes,
    ];
    if (areaServed.length > 0) jsonLd.areaServed = areaServed;
  }

  if (has("services") && site.services.length > 0) {
    jsonLd.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: site.businessName,
      itemListElement: site.services.map((service) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: service },
      })),
    };
  }

  // Hours are rendered inside the contact block, and only for days the owner
  // actually filled in. A day recorded as closed (`null`) produces no entry:
  // schema.org's way of saying "shut" is an opening spec of 00:00–00:00, which
  // reads to a parser as a business that opens, and the page simply says
  // "Closed" in words instead.
  if (has("contact_form")) {
    const openingHours = DAYS.flatMap((day) => {
      const hours = site.hours[day];
      if (!hours) return [];
      return [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: SCHEMA_DAYS[day],
          opens: hours.open,
          closes: hours.close,
        },
      ];
    });
    if (openingHours.length > 0) jsonLd.openingHoursSpecification = openingHours;
  }

  // Which languages a customer can be served in — a fact the owner stated by
  // offering the site in them, and the reason the language switch exists.
  jsonLd.knowsLanguage = [site.locale, ...site.otherLocales].map((locale) => LOCALE_TAGS[locale]);

  return jsonLd;
}

/**
 * The JSON-LD as it goes inside `<script type="application/ld+json">`.
 *
 * `<` is escaped because every string in here is text an owner typed. Without
 * it, an About paragraph containing `</script>` closes the tag early and the
 * rest of the profile lands in the document as markup — the one injection this
 * page is exposed to, since everything else is rendered as text nodes by React.
 * `>` and `&` follow for the same reason at no cost.
 */
export function jsonLdScriptText(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export interface SitemapUrl {
  loc: string;
  /** ISO 8601. When the published version this page serves was published. */
  lastModified?: string | null;
  /** `hreflang` pairs, including this page itself (which the spec requires). */
  alternates?: { hreflang: string; href: string }[];
}

function xmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A `urlset` document (§19.8 sitemap).
 *
 * Written out rather than produced by Next's `MetadataRoute.Sitemap`, because
 * this sitemap belongs to one business and its addresses are only knowable at
 * request time — the file-convention sitemap is resolved per build, and there
 * is no build at which the list of published slugs is known.
 */
export function buildSitemapXml(urls: readonly SitemapUrl[]): string {
  const body = urls
    .map((url) => {
      const parts = [`    <loc>${xmlText(url.loc)}</loc>`];
      if (url.lastModified) parts.push(`    <lastmod>${xmlText(url.lastModified)}</lastmod>`);
      for (const alternate of url.alternates ?? []) {
        parts.push(
          `    <xhtml:link rel="alternate" hreflang="${xmlText(alternate.hreflang)}" href="${xmlText(alternate.href)}" />`,
        );
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    // A site with no published languages is not reachable at all, but an empty
    // `urlset` is still a valid document and a blank line inside it is not.
    ...(body === "" ? [] : [body]),
    "</urlset>",
  ];
  return `${lines.join("\n")}\n`;
}

/** `lastmod` as the sitemap spec wants it, or null for anything unparseable. */
export function sitemapTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
