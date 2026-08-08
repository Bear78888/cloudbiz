import type { MetadataRoute } from "next";

import { resolveAppUrl } from "@/lib/app-url";
import { SPANISH_CONTENT_PUBLISHED } from "@/lib/config";
import { LOCALE_TAGS, LOCALES, pathFor, ROUTES, type Locale } from "@/lib/routes";

/**
 * The marketing site's sitemap (§19.8).
 *
 * Only our own pages. A contractor's published site is listed in a sitemap of
 * its own at `/pro/{slug}/sitemap.xml`, for the reason set out there: a single
 * file naming every customer would be a public directory of who they are.
 *
 * No hardcoded domain — see `resolveAppUrl`. An entry with the wrong host is
 * worse than no entry, because a sitemap is read by machines that will not
 * notice the address is not ours.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = resolveAppUrl();
  if (!baseUrl) return [];

  const locales: Locale[] = SPANISH_CONTENT_PUBLISHED ? [...LOCALES] : ["en"];

  return ROUTES.flatMap((route) =>
    locales.map((locale) => ({
      url: `${baseUrl}${pathFor(route, locale)}`,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [LOCALE_TAGS[l], `${baseUrl}${pathFor(route, l)}`]),
        ),
      },
    })),
  );
}
