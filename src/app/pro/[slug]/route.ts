import { NextResponse, type NextRequest } from "next/server";

import { defaultLocaleForSite } from "@/features/website/public-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `/pro/{slug}` → the site's first language (§19.6).
 *
 * A route handler rather than a page, and that is not an accident: every page
 * needs an ancestor layout carrying `<html>`, and the only layout on this
 * branch sits at `[locale]` because that is where the language is known. A
 * redirect has no markup, so it needs no layout, and the `lang` attribute stays
 * correct instead of being guessed one segment too early.
 *
 * An unpublished site and an unknown one both 404 here, exactly as they do one
 * segment down — a redirect that resolved would confirm the business exists.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const locale = await defaultLocaleForSite(slug);
  if (!locale) return new NextResponse(null, { status: 404 });

  return NextResponse.redirect(new URL(`/pro/${slug}/${locale}`, request.url), { status: 308 });
}
