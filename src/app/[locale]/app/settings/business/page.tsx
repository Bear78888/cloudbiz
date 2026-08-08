import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { BusinessProfileForm } from "@/features/profile/BusinessProfileForm";
import { profileGaps } from "@/features/profile/model";
import { getBusinessProfile } from "@/features/profile/service";
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
    title: `${dict.platform.businessProfile.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/**
 * The business profile (§10.2 steps 3–5).
 *
 * These columns have existed since the platform foundation and nothing has ever
 * written them, which is why the website's readiness list could ask for a phone
 * number with nowhere to type one. This is that nowhere.
 *
 * Owner-only (§11.3): it is the business's own contact details, and they are
 * what the public site publishes.
 */
export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const b = dict.platform.businessProfile;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/${l}/app`);

  const profile = await getBusinessProfile(supabase, membership.organizationId);
  if (!profile) notFound();

  const gaps = profileGaps(profile);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{b.title}</h1>
        <p className="mt-2 text-slate-600">{b.subtitle}</p>
      </div>

      {/* What is still blank, and why it is worth filling in — every one of
          these is a section the website leaves out rather than invents (§19.8). */}
      {gaps.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {b.gapsTitle}
          </h2>
          <ul aria-label={b.gapsTitle} className="mt-3 space-y-1.5 text-sm text-slate-700">
            {gaps.map((gap) => (
              <li key={gap}>• {b.gaps[gap]}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <BusinessProfileForm locale={l} dict={dict} profile={profile} trade={membership.trade} />

      <p className="text-sm text-slate-600">
        <Link href={`/${l}/app/settings/website`} className="font-semibold text-brand-700 underline">
          {b.websiteLink}
        </Link>
      </p>
    </div>
  );
}
