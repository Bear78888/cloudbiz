import type { MetadataRoute } from "next";
import { SPANISH_CONTENT_PUBLISHED } from "@/lib/config";
import { LOCALE_TAGS, LOCALES, pathFor, ROUTES, type Locale } from "@/lib/routes";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://handyalliance.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales: Locale[] = SPANISH_CONTENT_PUBLISHED ? [...LOCALES] : ["en"];

  return ROUTES.flatMap((route) =>
    locales.map((locale) => ({
      url: `${BASE_URL}${pathFor(route, locale)}`,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [LOCALE_TAGS[l], `${BASE_URL}${pathFor(route, l)}`]),
        ),
      },
    })),
  );
}
