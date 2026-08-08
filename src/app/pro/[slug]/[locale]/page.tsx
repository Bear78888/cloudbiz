import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteView } from "@/features/website/SiteView";
import { getPublishedSite } from "@/features/website/public-service";
import { buildLocalBusinessJsonLd, jsonLdScriptText, siteDescription } from "@/features/website/seo";
import { resolveAppUrl } from "@/lib/app-url";
import { getDict } from "@/lib/i18n";
import { isLocale, LOCALE_TAGS, type Locale } from "@/lib/routes";

/**
 * A contractor's published website (§19.6).
 *
 * The second surface of this product a stranger can reach, and unlike the
 * customer's copy of an estimate this one is *meant* to be found — so the rules
 * differ in one place and hold in another:
 *
 *  - Indexable, with a title and description built from what the owner wrote.
 *    §19.8 asks for that.
 *  - Nothing of ours on the page. Not a name, not a badge, not a link. See the
 *    note in `SiteView`.
 *
 * A draft, a slug nobody has, and a language this site is not offered in are
 * all the same 404: telling them apart would leak that a business exists and
 * has not published.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  if (!isLocale(locale)) return {};

  const published = await getPublishedSite(slug, locale as Locale);
  if (!published) return { robots: { index: false } };

  const { site } = published;
  const base = resolveAppUrl();
  const canonical = base ? `${base}/pro/${slug}/${locale}` : null;

  // The description is the owner's own words, never generated: §19.8 forbids
  // inventing copy, and a meta description is copy that ends up in a search
  // result under their name.
  const description = siteDescription(site);
  const title = `${site.businessName} — ${site.headline}`;

  return {
    title,
    description,
    alternates: canonical
      ? {
          canonical,
          languages: Object.fromEntries(
            [site.locale, ...site.otherLocales].map((other) => [
              LOCALE_TAGS[other],
              `${base}/pro/${slug}/${other}`,
            ]),
          ),
        }
      : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      // The business's name, because on this page there is no other site (§19).
      siteName: site.businessName,
      url: canonical ?? undefined,
      locale: locale === "es" ? "es_US" : "en_US",
      alternateLocale: site.otherLocales.map((other) => (other === "es" ? "es_US" : "en_US")),
    },
    // A share card with no image is a card with a title and a description on it,
    // which is what this page has until photo upload exists (§19.8 image
    // optimization, alt text). `summary` says so; `summary_large_image` would
    // promise an image that is not there.
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;

  const published = await getPublishedSite(slug, l);
  if (!published) notFound();

  const base = resolveAppUrl();
  const jsonLd = buildLocalBusinessJsonLd(
    published.site,
    base ? `${base}/pro/${slug}/${l}` : null,
  );

  return (
    <>
      {/* §19.8 LocalBusiness structured data. Rendered on the page rather than
          returned from `generateMetadata`, which has no way to emit a script.
          Every value in it is already visible above — see `seo.ts` for why that
          is a rule and not a coincidence. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptText(jsonLd) }}
      />
      <SiteView
        site={published.site}
        dict={getDict(l)}
        hrefForLocale={(other) => `/pro/${slug}/${other}`}
        canSubmitLeads
      />
    </>
  );
}
