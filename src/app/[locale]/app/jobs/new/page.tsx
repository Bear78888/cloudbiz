import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobForm } from "@/features/jobs/JobForm";
import { listAssignableMembers } from "@/features/jobs/service";
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
    title: `${dict.platform.jobs.form.newTitle} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const f = dict.platform.jobs.form;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();

  const members = await listAssignableMembers(supabase, membership.organizationId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{f.newTitle}</h1>
        <p className="mt-1 text-slate-600">{f.newSub}</p>
      </div>
      <JobForm locale={l} dict={dict} timeZone={membership.timezone} members={members} />
    </div>
  );
}
