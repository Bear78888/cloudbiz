import type { MetadataRoute } from "next";

import { resolveAppUrl } from "@/lib/app-url";

/**
 * `robots.txt` for the whole deployment (§19.8).
 *
 * One file per host, so this covers the marketing site, the owner's console and
 * every contractor's page at `/pro/...` — which is why the disallow list is
 * here and not something each surface can decide for itself.
 *
 * What is kept out of the index:
 *
 *  - `/{locale}/app`, `/{locale}/onboarding`, `/{locale}/admin` — signed-in
 *    screens. Every one of them already carries `robots: { index: false }`, but
 *    a meta tag is only read after the page is fetched, and these are not pages
 *    a crawler should be spending requests on at all.
 *  - `/e/` — a customer's copy of an estimate, reachable by an unguessable
 *    token (§5f). Nothing links to one, so nothing should be crawling one.
 *  - `/api/` — endpoints, not pages.
 *
 * `/pro/` is deliberately not on the list: those pages are meant to be found.
 * Their sitemaps are per business and not announced here — see the note in
 * `/pro/[slug]/sitemap.xml`.
 *
 * The base URL is resolved rather than hardcoded. There used to be a
 * `https://handyalliance.com` literal here, and that domain does not currently
 * serve this platform: it named a sitemap that does not exist, on a deployment
 * that has a perfectly good address of its own.
 */
export default function robots(): MetadataRoute.Robots {
  const base = resolveAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/e/", "/*/app", "/*/onboarding", "/*/admin"],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
