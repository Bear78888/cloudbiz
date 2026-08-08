import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { getBusinessProfile } from "@/features/profile/service";
import { SiteView } from "@/features/website/SiteView";
import { buildRenderableSite } from "@/features/website/render";
import { contentFor, getSite, listSiteContent } from "@/features/website/service";
import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDict(locale);
  return {
    title: `${dict.platform.website.previewTitle} — ${dict.meta.siteName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * The owner's preview of their own site (§19.10: preview before publish).
 *
 * Rendered by `SiteView` and assembled by `buildRenderableSite` — the same two
 * functions the public page uses, on purpose. A preview built by a second code
 * path is a preview that eventually disagrees with what gets published, which
 * makes "check it before you publish" advice nobody can act on.
 *
 * The difference from the public page is what it reads, not how it renders:
 * this one reads the *draft* through the owner's own session and RLS, so it
 * works before anything is published and shows unsaved-to-the-world changes.
 */
export default async function WebsitePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ content?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const w = dict.platform.website;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/${l}/app`);

  const profile = await getBusinessProfile(supabase, membership.organizationId);
  if (!profile) notFound();

  const [site, contentRows] = await Promise.all([
    getSite(supabase, membership.organizationId),
    listSiteContent(supabase, membership.organizationId),
  ]);

  const locales = profile.supportedLocales.filter(
    (candidate): candidate is Locale => candidate === "en" || candidate === "es",
  );

  const { content: requested } = await searchParams;
  const previewLocale: Locale =
    requested && isLocale(requested) && locales.includes(requested)
      ? requested
      : (locales[0] ?? "en");

  const renderable = buildRenderableSite({
    locale: previewLocale,
    slug: profile.websiteSlug ?? "",
    site: {
      template: site?.template ?? "classic",
      colorPreset: site?.colorPreset ?? "navy",
      hiddenBlocks: site?.hiddenBlocks ?? [],
    },
    profile: { ...profile, supportedLocales: locales },
    content: contentFor(contentRows, previewLocale),
  });

  return (
    <div className="space-y-6">
      {/* The bar says which language is on screen and that none of this is
          public yet. It is outside the framed page below, so nothing in it can
          be mistaken for part of the site. */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/${l}/app/settings/website`} className="font-semibold text-brand-700 underline">
          ← {w.backToSettings}
        </Link>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          {site?.status === "published" ? w.previewOfPublished : w.previewOfDraft}
        </span>
        {locales.length > 1
          ? locales.map((other) => (
              <Link
                key={other}
                href={`/${l}/app/settings/website/preview?content=${other}`}
                aria-current={other === previewLocale ? "page" : undefined}
                className={
                  other === previewLocale
                    ? "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                {w.localeNames[other]}
              </Link>
            ))
          : null}
      </div>

      {/* Framed rather than full-bleed: this is the owner's dashboard, and a
          page that filled it edge to edge would read as having navigated away. */}
      <div className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-300">
        <SiteView site={renderable} dict={dict} />
      </div>
    </div>
  );
}
