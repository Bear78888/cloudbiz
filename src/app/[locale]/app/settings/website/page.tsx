import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { SiteContentForm } from "@/features/website/SiteContentForm";
import { SiteSettingsForm } from "@/features/website/SiteSettingsForm";
import {
  rollbackSiteAction,
  setSiteStatusAction,
  translateSiteContentAction,
} from "@/features/website/actions";
import {
  needsReview,
  siteBlockers,
  siteSitemapUrl,
  siteUrl,
  visibleBlocks,
} from "@/features/website/model";
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
    translated?: string;
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
  const {
    content: requested,
    published,
    withdrawn,
    restored,
    translated,
    blocked,
  } = await searchParams;
  const contentLocale: Locale =
    requested && isLocale(requested) && profile.locales.includes(requested)
      ? requested
      : (profile.locales[0] ?? "en");

  const content = contentFor(contentRows, contentLocale);

  // Which language this one could be drafted from: another offered language
  // that actually has something in it. Offering to translate from a blank page
  // would be offering to spend a model call on nothing.
  const translationSource =
    profile.locales.find((candidate) => {
      if (candidate === contentLocale) return false;
      const other = contentFor(contentRows, candidate);
      return Boolean(other.headline?.trim()) || Boolean(other.aboutText?.trim());
    }) ?? null;
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
  const sitemapUrl = profile.slug ? siteSitemapUrl(baseUrl, profile.slug) : null;

  // Outcomes from `setSiteStatusAction`, which travel in the URL because this
  // is a server component. Anything unrecognised is ignored rather than shown.
  const notice = ((): { text: string; tone: "ok" | "problem" } | null => {
    if (published) return { text: w.publishedNotice, tone: "ok" };
    if (withdrawn) return { text: w.withdrawnNotice, tone: "ok" };
    if (restored) return { text: w.restoredNotice, tone: "ok" };
    if (blocked === "limit_reached") return { text: w.translateLimitNotice, tone: "problem" };
    if (blocked === "not_configured") return { text: w.translateOffNotice, tone: "problem" };
    if (blocked === "no_source") return { text: w.translateNoSourceNotice, tone: "problem" };
    if (blocked === "unavailable") return { text: w.translateFailedNotice, tone: "problem" };
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

        {/* §19.8. Only once the site is live, because that is when the address
            starts answering — offering it earlier would send an owner to Search
            Console to submit a file that 404s. */}
        {isPublished && sitemapUrl ? (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{w.sitemapTitle}:</span>{" "}
            <a
              href={sitemapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {sitemapUrl}
            </a>
            <br />
            {w.sitemapHint}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/${l}/app/settings/website/preview`}
            className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-800 hover:bg-slate-50"
          >
            {w.preview}
          </Link>

          {/* Publishing and withdrawing are two buttons, not one toggle.
              They were one, and it meant that after the first publish there
              was no way to publish an edit at all: the only control on screen
              said "Take it down". With versions, publishing again is the
              ordinary action — every edit needs it — so it cannot be the thing
              that disappears the moment it starts being useful. */}
          <form action={setSiteStatusAction}>
            <input type="hidden" name="locale" value={l} />
            <input type="hidden" name="status" value="published" />
            <button
              type="submit"
              disabled={blockers.length > 0}
              className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPublished ? w.republish : w.publish}
            </button>
          </form>

          {isPublished ? (
            <form action={setSiteStatusAction}>
              <input type="hidden" name="locale" value={l} />
              <input type="hidden" name="status" value="draft" />
              <button
                type="submit"
                className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 px-5 font-semibold text-slate-800 hover:bg-slate-50"
              >
                {w.unpublish}
              </button>
            </form>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {isPublished ? w.republishHint : w.publishHint}
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

        {/* §19.5: the model drafts, the owner confirms. The button is a form of
            its own and sits outside the editor — a form cannot be nested inside
            another form, and this one must not carry the editor's fields. */}
        {translationSource ? (
          <form action={translateSiteContentAction} className="mt-4">
            <input type="hidden" name="locale" value={l} />
            <input type="hidden" name="content_locale" value={contentLocale} />
            <input type="hidden" name="source_locale" value={translationSource} />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
            >
              {fmt(w.translateFrom, { language: w.localeNames[translationSource] })}
            </button>
            <p className="mt-2 text-xs text-slate-500">{w.translateHint}</p>
          </form>
        ) : null}

        {translated ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          >
            {w.translatedNotice}
          </p>
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
