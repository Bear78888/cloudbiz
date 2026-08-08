import { NextResponse, type NextRequest } from "next/server";

import { publishedSiteIndex } from "@/features/website/public-service";
import { buildSitemapXml, sitemapTimestamp } from "@/features/website/seo";
import { resolveAppUrl } from "@/lib/app-url";
import { LOCALE_TAGS } from "@/lib/routes";

/**
 * One business's sitemap (§19.8).
 *
 * Per site rather than one platform-wide file, and that is the whole design
 * decision here. A single sitemap listing every published site would be a
 * public directory of who our customers are, served from our domain — the same
 * kind of advertisement §19 keeps off the page itself, only harder to notice.
 * A file at the business's own address is the artefact the owner actually needs
 * anyway: it is what gets pasted into Google Search Console, and the settings
 * screen shows them the address for exactly that.
 *
 * A route handler rather than Next's `sitemap.ts` convention, because the file
 * convention resolves per build and the list of published slugs is not knowable
 * at any build.
 *
 * Unpublished and unknown are the same 404 as everywhere else on this branch:
 * a sitemap that answered would confirm a business exists before its owner
 * decided to be public.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const index = await publishedSiteIndex(slug);
  if (!index) return new NextResponse(null, { status: 404 });

  const base = resolveAppUrl();
  // Absolute URLs are not optional in a sitemap — a relative `loc` is not a
  // valid entry — so a deployment that cannot name itself serves nothing rather
  // than a document full of addresses that resolve nowhere.
  if (!base) return new NextResponse(null, { status: 404 });

  const lastModified = sitemapTimestamp(index.publishedAt);
  const alternates = index.locales.map((locale) => ({
    hreflang: LOCALE_TAGS[locale],
    href: `${base}/pro/${slug}/${locale}`,
  }));

  const xml = buildSitemapXml(
    index.locales.map((locale) => ({
      loc: `${base}/pro/${slug}/${locale}`,
      lastModified,
      // Every language points at every language, itself included: that is what
      // the annotation asks for, and a one-way link is the usual way hreflang
      // gets ignored.
      alternates,
    })),
  );

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Short, because "published" can stop being true at any moment and a
      // sitemap cached for a day would keep advertising a page that 404s.
      "cache-control": "public, max-age=0, s-maxage=300",
    },
  });
}
