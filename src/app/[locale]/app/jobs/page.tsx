import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JobsFilters, buildJobsHref, type JobsQueryState } from "@/features/jobs/JobsFilters";
import { JobsList } from "@/features/jobs/JobsList";
import {
  MAX_SEARCH_LENGTH,
  isJobStatus,
  parseSort,
  parseView,
  type JobPriority,
  type JobStatus,
} from "@/features/jobs/model";
import { countDeletedJobs, listJobs, listAssignableMembers } from "@/features/jobs/service";
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
    title: `${dict.platform.jobs.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Job Tracker list (§13.7–§13.9). Free for every organization (§13.1). */
export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const j = dict.platform.jobs;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();

  // Job Tracker is free (§13.1); the entitlement only matters when an admin has
  // suspended it (§11.5), which must read as a paused tool, not as an error.
  const { data: entitlement } = await supabase
    .from("entitlements")
    .select("status")
    .eq("organization_id", membership.organizationId)
    .eq("feature_code", "job_tracker")
    .maybeSingle();
  if (entitlement && entitlement.status !== "active") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-bold text-slate-900">{j.blockedTitle}</h1>
        <p className="mt-2 text-slate-700">{j.blockedBody}</p>
      </section>
    );
  }

  const statusParam = single(query, "status");
  const priorityParam = single(query, "priority");
  const state: JobsQueryState = {
    view: parseView(single(query, "view") || undefined),
    sort: parseSort(single(query, "sort") || undefined),
    q: single(query, "q").slice(0, MAX_SEARCH_LENGTH),
    status: isJobStatus(statusParam) ? statusParam : "",
    priority: priorityParam === "normal" || priorityParam === "urgent" ? priorityParam : "",
    assigned: single(query, "assigned"),
    deleted: single(query, "deleted") === "1",
  };
  const page = Math.max(1, Number.parseInt(single(query, "page") || "1", 10) || 1);

  const [members, deletedCount] = await Promise.all([
    listAssignableMembers(supabase, membership.organizationId),
    countDeletedJobs(supabase, membership.organizationId),
  ]);

  const { jobs, total, pageCount } = await listJobs(supabase, {
    organizationId: membership.organizationId,
    view: state.view,
    sort: state.sort,
    search: state.q || undefined,
    status: (state.status || undefined) as JobStatus | undefined,
    priority: (state.priority || undefined) as JobPriority | undefined,
    assignedUserId: members.some((m) => m.id === state.assigned) ? state.assigned : undefined,
    deleted: state.deleted,
    page,
  });

  const filtered = Boolean(state.q || state.status || state.priority || state.assigned);
  const emptyCopy = state.deleted
    ? { title: j.empty.deletedTitle, body: j.empty.deletedBody }
    : filtered || state.view !== "all_jobs"
      ? { title: j.empty.filteredTitle, body: j.empty.filteredBody }
      : { title: j.empty.title, body: j.empty.body };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{j.title}</h1>
          <p className="mt-1 text-slate-600">{j.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${l}/app/jobs/import`}
            className="inline-flex min-h-12 items-center rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
          >
            {j.importAction}
          </Link>
          <Link
            href={`/${l}/app/jobs/new`}
            className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
          >
            {j.addJob}
          </Link>
        </div>
      </div>

      <JobsFilters
        locale={l}
        dict={dict}
        state={state}
        members={members}
        deletedCount={deletedCount}
      />

      {jobs.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900">{emptyCopy.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-600">{emptyCopy.body}</p>
          {!state.deleted && !filtered && state.view === "all_jobs" ? (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href={`/${l}/app/jobs/new`}
                className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
              >
                {j.addFirstJob}
              </Link>
              <Link
                href={`/${l}/app/jobs/import`}
                className="inline-flex min-h-12 items-center rounded-xl border-2 border-brand-200 bg-white px-6 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
              >
                {j.importAction}
              </Link>
            </div>
          ) : (
            <Link
              href={buildJobsHref(l, { view: "all_jobs" })}
              className="mt-5 inline-block font-semibold text-brand-700 underline"
            >
              {j.clearFilters}
            </Link>
          )}
        </section>
      ) : (
        <JobsList
          jobs={jobs}
          locale={l}
          dict={dict}
          timeZone={membership.timezone}
          currency={membership.currency}
          state={state}
          total={total}
          page={page}
          pageCount={pageCount}
        />
      )}
    </div>
  );
}
