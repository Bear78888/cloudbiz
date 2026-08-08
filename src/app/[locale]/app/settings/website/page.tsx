import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { SiteContentForm } from "@/features/website/SiteContentForm";
import { SiteSettingsForm } from "@/features/website/SiteSettingsForm";
import { rollbackSiteAction, setSiteStatusAction } from "@/features/website/actions";
import { needsReview, siteBlockers, siteUrl, visibleBlocks } from "@/features/website/model";
import {
  contentFor,
  getSite,
  getSiteProfile,
  listSiteContent,
  listSiteVersions,
} from "@/features/website/service";
import { resolveAppUrl } from "@/lib/app-url";
import { fmt, getDict } from "@/lib/i18n";
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
    title: `${dict.platform.website.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/** The settings the site has before anyone has opened this screen (§19.3). */
const DEFAULT_SITE = {
  template: "classic",
  colorPreset: "navy",
  hiddenBlocks: [] as string[],
} as const;

/**
 * Business Website settings (§19.3–19.5).
 *
 * Owner-only (§11.3): this is the copy the public reads under the owner's own
 * name, and the address it is served at is unique across the whole platform.
 *
 * What an owner builds here stays a private draft until they press Publish
 * (§19.10), and the readiness list is what Publish checks — re-checked in the
 * service against the database, because this page may be minutes stale by the
 * time the button is pressed.
 */
export default async function WebsiteSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    content?: string;
    published?: string;
    withdrawn?: string;
    restored?: string;
    blocked?: string;
  }>;
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

  const profile = await getSiteProfile(supabase, membership.organizationId);
  if (!profile) notFound();

  const [site, contentRows] = await Promise.all([
    getSite(supabase, membership.organizationId),
    listSiteContent(supabase, membership.organizationId),
  ]);

  const settings = site ?? DEFAULT_SITE;

  // Which language is being edited. Only ever one the site is actually offered
  // in: a `?content=es` on an English-only site would otherwise open an editor
  // for a page that will never be rendered.
  const { content: requested, published, withdrawn, restored, blocked } = await searchParams;
  const contentLocale: Locale =
    requested && isLocale(requested) && profile.locales.includes(requested)
      ? requested
      : (profile.locales[0] ?? "en");

  const content = contentFor(contentRows, contentLocale);
  const blockers = siteBlockers({
    slug: profile.slug,
    locales: profile.locales,
    profile,
    content: contentRows,
  });
  const blocks = visibleBlocks(settings, profile, content);
  const baseUrl = resolveAppUrl();

  const versions = site
    ? await listSiteVersions(supabase, membership.organizationId, site.publishedVersionId)
    : [];
  const isPublished = site?.status === "published";
  const liveVersion = versions.find((entry) => entry.isLive)?.version ?? null;
  const liveUrl = profile.slug ? siteUrl(baseUrl, profile.slug, contentLocale) : null;

  // Outcomes from `setSiteStatusAction`, which travel in the URL because this
  // is a server component. Anything unrecognised is ignored rather than shown.
  const notice = ((): { text: string; tone: "ok" | "problem" } | null => {
    if (published) return { text: w.publishedNotice, tone: "ok" };
    if (withdrawn) return { text: w.withdrawnNotice, tone: "ok" };
    if (restored) return { text: w.restoredNotice, tone: "ok" };
    if (blocked === "not_ready") return { text: w.notReadyNotice, tone: "problem" };
    if (blocked === "not_found") return { text: w.noSiteYetNotice, tone: "problem" };
    if (blocked === "not_owner") return { text: w.notOwnerError, tone: "problem" };
    if (blocked) return { text: w.genericError, tone: "problem" };
    return null;
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{w.title}</h1>
        <p className="mt-2 text-slate-600">{w.subtitle}</p>
      </div>

      {/* §19.10 in list form. Shown before the forms because it is the answer to
          "what do I still have to do", which is the question someone opens this
          screen with. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.readinessTitle}
        </h2>
        {blockers.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-emerald-800">{w.readyBody}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              {blockers.map((blocker) => (
                <li key={blocker}>• {w.blockers[blocker]}</li>
              ))}
            </ul>
            {/* Two of these live on the business profile, not here. Saying so
                with a link is the difference between a checklist and a
                checklist someone can act on. */}
            <p className="mt-3 text-sm">
              <Link
                href={`/${l}/app/settings/business`}
                className="font-semibold text-brand-700 underline"
              >
                {w.profileLink}
              </Link>
            </p>
          </>
        )}
      </section>

      {/* Publishing (§19.10). Preview first, because it is the thing to do
          before publishing and putting it after the button would be advice
          nobody reads in time. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.publishTitle}
        </h2>

        {notice ? (
          <p
            role={notice.tone === "ok" ? "status" : "alert"}
            className={
              notice.tone === "ok"
                ? "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
                : "mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
            }
          >
            {notice.text}
          </p>
        ) : null}

        {/* Status is never carried by colour alone (§8.3). */}
        <p className="mt-3 text-sm font-medium text-slate-800">
          {isPublished ? w.statusPublished : w.statusDraft}
        </p>

        {isPublished && liveVersion ? (
          <p className="mt-1 text-sm text-slate-600">
            {fmt(w.publishedVersion, { version: liveVersion })}
          </p>
        ) : null}

        {isPublished && liveUrl ? (
          <p className="mt-2 text-sm">
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-700 underline"
            >
              {liveUrl}
            </a>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/${l}/app/settings/website/preview`}
            className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-800 hover:bg-slate-50"
          >
            {w.preview}
          </Link>

          <form action={setSiteStatusAction}>
            <input type="hidden" name="locale" value={l} />
            <input type="hidden" name="status" value={isPublished ? "draft" : "published"} />
            <button
              type="submit"
              disabled={!isPublished && blockers.length > 0}
              className={
                isPublished
                  ? "inline-flex min-h-12 items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-800 hover:bg-slate-50"
                  : "inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              }
            >
              {isPublished ? w.unpublish : w.publish}
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {isPublished ? w.unpublishHint : w.publishHint}
        </p>
      </section>

      {/* Version history (§19.10). Only worth a section once there is more than
          one thing to choose between — a list with a single entry is a list
          that asks a question nobody has. */}
      {versions.length > 1 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {w.versionsTitle}
          </h2>
          <ul aria-label={w.versionsTitle} className="mt-3 divide-y divide-slate-100">
            {versions.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium text-slate-900">
                  {fmt(w.versionLabel, { version: entry.version })}
                </span>
                <span className="text-sm text-slate-600">
                  {new Date(entry.publishedAt).toLocaleString(l, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: membership.timezone,
                  })}
                </span>
                {entry.isLive ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {w.versionLive}
                  </span>
                ) : (
                  <form action={rollbackSiteAction} className="ml-auto">
                    <input type="hidden" name="locale" value={l} />
                    <input type="hidden" name="version_id" value={entry.id} />
                    <button
                      type="submit"
                      className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      {w.restore}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{w.versionsHint}</p>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-bold text-slate-900">{w.settingsSection}</h2>
        <div className="mt-4">
          <SiteSettingsForm
            locale={l}
            dict={dict}
            baseUrl={baseUrl}
            site={settings}
            slug={profile.slug}
            suggestedFrom={profile.displayName}
            locales={profile.locales}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900">{w.contentSection}</h2>

        {/* The language switch is links rather than a select, so that the
            chosen language is in the URL: an owner mid-way through a Spanish
            page can reload, bookmark it, or come back to it after a save. */}
        {profile.locales.length > 1 ? (
          <nav aria-label={w.contentLocaleLabel} className="mt-3 flex flex-wrap gap-2">
            {profile.locales.map((siteLocale) => {
              const active = siteLocale === contentLocale;
              return (
                <Link
                  key={siteLocale}
                  href={`/${l}/app/settings/website?content=${siteLocale}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  }
                >
                  {w.localeNames[siteLocale]}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {/* §19.5: a machine translation is a draft until a person says
            otherwise, and this is where they find out that it is waiting. */}
        {needsReview(content) ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          >
            {w.translationNeedsReview}
          </p>
        ) : null}

        <div className="mt-4">
          <SiteContentForm
            key={contentLocale}
            locale={l}
            contentLocale={contentLocale}
            dict={dict}
            content={content}
          />
        </div>
      </section>

      {/* What the page would consist of as things stand. Blocks vanish from
          here when there is nothing to put in them (§19.8 forbids inventing
          reviews, service areas and credentials), so an owner wondering where
          their Reviews section went can see that it is waiting on a review
          link rather than broken. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.currentBlocksTitle}
        </h2>
        <ul aria-label={w.currentBlocksTitle} className="mt-3 flex flex-wrap gap-2">
          {blocks.map((block) => (
            <li
              key={block}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {w.blocks[block]}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">{w.currentBlocksHint}</p>
      </section>
    </div>
  );
}
