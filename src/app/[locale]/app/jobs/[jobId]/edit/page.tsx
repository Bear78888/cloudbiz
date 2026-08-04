import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobForm } from "@/features/jobs/JobForm";
import { getJob, listAssignableMembers } from "@/features/jobs/service";
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
    title: `${dict.platform.jobs.form.editTitle} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ locale: string; jobId: string }>;
}) {
  const { locale, jobId } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const j = dict.platform.jobs;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();

  const [job, members] = await Promise.all([
    getJob(supabase, membership.organizationId, jobId),
    listAssignableMembers(supabase, membership.organizationId),
  ]);

  if (!job) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">{j.notFoundTitle}</h1>
        <p className="mt-2 text-slate-600">{j.notFoundBody}</p>
        <Link href={`/${l}/app/jobs`} className="mt-5 inline-block font-semibold text-brand-700 underline">
          {j.backToList}
        </Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{j.form.editTitle}</h1>
        <p className="mt-1 text-slate-600">{j.form.editSub}</p>
      </div>
      <JobForm locale={l} dict={dict} timeZone={membership.timezone} members={members} job={job} />
    </div>
  );
}
