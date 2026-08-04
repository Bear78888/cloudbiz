import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportWizard } from "@/features/jobs/ImportWizard";
import { getCurrentMembership } from "@/features/organizations/service";
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
    title: `${dict.platform.jobs.import.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/** One-time CSV import (§14.15). */
export default async function ImportJobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const t = dict.platform.jobs.import;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/${l}/app/jobs`} className="inline-block text-sm font-semibold text-brand-700 underline">
        ← {dict.platform.jobs.backToList}
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-slate-600">{t.sub}</p>
      </div>
      <ImportWizard locale={l} dict={dict} timeZone={membership.timezone} />
    </div>
  );
}
