import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteView } from "@/features/website/SiteView";
import { getPublishedSite } from "@/features/website/public-service";
import { resolveAppUrl } from "@/lib/app-url";
import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";

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

  // The description is the owner's own words, never generated: §19.8 forbids
  // inventing copy, and a meta description is copy that ends up in a search
  // result under their name.
  const description = site.subheadline ?? site.aboutText?.slice(0, 160) ?? undefined;

  return {
    title: `${site.businessName} — ${site.headline}`,
    description,
    alternates: base
      ? {
          canonical: `${base}/pro/${slug}/${locale}`,
          languages: Object.fromEntries(
            [locale as Locale, ...site.otherLocales].map((other) => [
              other === "es" ? "es-US" : "en-US",
              `${base}/pro/${slug}/${other}`,
            ]),
          ),
        }
      : undefined,
    openGraph: {
      title: `${site.businessName} — ${site.headline}`,
      description,
      type: "website",
      locale: locale === "es" ? "es_US" : "en_US",
    },
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

  return (
    <SiteView
      site={published.site}
      dict={getDict(l)}
      hrefForLocale={(other) => `/pro/${slug}/${other}`}
    />
  );
}
