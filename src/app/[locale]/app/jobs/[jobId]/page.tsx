import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createEstimateAction } from "@/features/estimates/actions";
import { listEstimatesForJob } from "@/features/estimates/service";
import {
  changeJobStatusAction,
  setJobDeletedAction,
} from "@/features/jobs/actions";
import { JobActivityFeed } from "@/features/jobs/JobActivityFeed";
import { DeletedBadge, PaymentBadge, PriorityBadge, StatusBadge } from "@/features/jobs/JobBadges";
import { JOB_STATUSES, jobMargin } from "@/features/jobs/model";
import { getJob, getJobActivities, listAssignableMembers } from "@/features/jobs/service";
import { getCurrentMembership } from "@/features/organizations/service";
import { formatDate, formatDateTime, formatMoney } from "@/lib/datetime";
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
  return { title: `${dict.platform.jobs.title} — ${dict.meta.siteName}`, robots: { index: false } };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/** Job card (§13.8): the whole job, its money, its history and its actions. */
export default async function JobDetailPage({
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

  const job = await getJob(supabase, membership.organizationId, jobId);
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

  const [activities, members, estimates] = await Promise.all([
    getJobActivities(supabase, membership.organizationId, job.id),
    listAssignableMembers(supabase, membership.organizationId),
    listEstimatesForJob(supabase, membership.organizationId, job.id),
  ]);

  const tz = membership.timezone;
  const currency = membership.currency;
  const margin = jobMargin(job);
  const assignee = members.find((m) => m.id === job.assigned_user_id);
  const e = dict.platform.estimates;

  return (
    <div className="space-y-6">
      <Link href={`/${l}/app/jobs`} className="inline-block text-sm font-semibold text-brand-700 underline">
        ← {j.backToList}
      </Link>

      {job.deleted_at ? (
        <p className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
          {j.detail.deletedBanner}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} dict={dict} />
            <PaymentBadge status={job.payment_status} dict={dict} />
            <PriorityBadge priority={job.priority} dict={dict} />
            {job.deleted_at ? <DeletedBadge dict={dict} /> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{job.title}</h1>
          <p className="mt-1 text-slate-600">{job.customer?.name ?? "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${l}/app/jobs/${job.id}/edit`}
            className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
          >
            {j.detail.edit}
          </Link>
        </div>
      </div>

      {/* Status change (§13.8). A plain form, so it works without JavaScript. */}
      {!job.deleted_at ? (
        <form
          action={changeJobStatusAction}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="locale" value={l} />
          <input type="hidden" name="job_id" value={job.id} />
          <div>
            <label htmlFor="status-change" className="block text-sm font-semibold text-slate-700">
              {j.detail.changeStatus}
            </label>
            <select
              id="status-change"
              name="status"
              defaultValue={job.status}
              className="mt-1.5 min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {j.statuses[status]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
          >
            {j.form.save}
          </button>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {j.detail.jobSection}
          </h2>
          <dl className="mt-3">
            <DetailRow label={j.form.service} value={job.service || j.detail.noAmount} />
            <DetailRow
              label={j.form.leadSource}
              value={job.source ? j.leadSources[job.source as keyof typeof j.leadSources] : j.detail.noAmount}
            />
            <DetailRow label={j.form.address} value={job.address || j.detail.noAmount} />
            <DetailRow
              label={j.form.scheduledStart}
              value={
                job.scheduled_start ? formatDateTime(job.scheduled_start, l, tz) : j.detail.noSchedule
              }
            />
            {job.scheduled_end ? (
              <DetailRow label={j.form.scheduledEnd} value={formatDateTime(job.scheduled_end, l, tz)} />
            ) : null}
            <DetailRow label={j.assignedTo} value={assignee?.label ?? j.unassigned} />
            <DetailRow label={j.detail.created} value={formatDate(job.created_at, l, tz)} />
            <DetailRow label={j.detail.updated} value={formatDate(job.updated_at, l, tz)} />
          </dl>

          {job.description ? (
            <p className="mt-4 whitespace-pre-wrap text-slate-700">{job.description}</p>
          ) : null}
          {job.notes ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{j.form.notes}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{job.notes}</p>
            </div>
          ) : null}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {j.detail.customerSection}
            </h2>
            <dl className="mt-3">
              <DetailRow label={j.form.customerName} value={job.customer?.name ?? "—"} />
              <DetailRow
                label={j.form.phone}
                value={
                  job.customer?.phone ? (
                    <a href={`tel:${job.customer.phone}`} className="text-brand-700 underline">
                      {job.customer.phone}
                    </a>
                  ) : (
                    j.detail.noPhone
                  )
                }
              />
              <DetailRow
                label={j.form.email}
                value={
                  job.customer?.email ? (
                    <a href={`mailto:${job.customer.email}`} className="text-brand-700 underline">
                      {job.customer.email}
                    </a>
                  ) : (
                    j.detail.noEmail
                  )
                }
              />
              <DetailRow
                label={j.form.preferredLanguage}
                value={job.customer?.preferred_locale === "es" ? "Español" : "English"}
              />
            </dl>
            <p className="mt-3 text-xs font-medium text-slate-600">
              {job.customer?.sms_consent ? j.detail.smsConsentOn : j.detail.smsConsentOff}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {j.detail.moneySection}
            </h2>
            <dl className="mt-3">
              <DetailRow
                label={j.form.estimateAmount}
                value={
                  job.estimate_amount !== null
                    ? formatMoney(job.estimate_amount, l, currency)
                    : j.detail.noAmount
                }
              />
              <DetailRow
                label={j.form.jobTotal}
                value={job.job_total !== null ? formatMoney(job.job_total, l, currency) : j.detail.noAmount}
              />
              <DetailRow
                label={j.form.materialsCost}
                value={
                  job.materials_cost !== null
                    ? formatMoney(job.materials_cost, l, currency)
                    : j.detail.noAmount
                }
              />
              {margin !== null ? (
                <DetailRow label={j.detail.margin} value={formatMoney(margin, l, currency)} />
              ) : null}
            </dl>
          </section>
        </div>
      </div>

      {/* Estimates (§16). Versions rather than edits: the document a customer
          accepted has to keep existing (§25.3). */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {e.sectionTitle}
        </h2>

        {estimates.length === 0 ? (
          <p className="mt-3 text-slate-600">{e.sectionEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {estimates.map((estimate) => (
              <li
                key={estimate.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2"
              >
                <span className="text-slate-800">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {fmt(e.versionLabel, { version: estimate.version })} ·{" "}
                    {e.statuses[estimate.status]}
                  </span>{" "}
                  {estimate.title}
                </span>
                <span className="flex items-baseline gap-4">
                  <span className="font-semibold text-slate-900">
                    {formatMoney(Number(estimate.total), l, currency)}
                  </span>
                  <Link
                    href={`/${l}/app/jobs/${job.id}/estimates/${estimate.id}`}
                    className="font-semibold text-brand-700 underline"
                  >
                    {e.openEstimate}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}

        {!job.deleted_at ? (
          <form action={createEstimateAction} className="mt-4">
            <input type="hidden" name="locale" value={l} />
            <input type="hidden" name="job_id" value={job.id} />
            <button
              type="submit"
              className="min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
            >
              {estimates.length === 0 ? e.create : e.createAnother}
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {j.detail.activitySection}
        </h2>
        <div className="mt-4">
          <JobActivityFeed activities={activities} dict={dict} locale={l} timeZone={tz} />
        </div>
      </section>

      {/* Soft delete / restore (§14.12). */}
      <form action={setJobDeletedAction}>
        <input type="hidden" name="locale" value={l} />
        <input type="hidden" name="job_id" value={job.id} />
        <input type="hidden" name="deleted" value={job.deleted_at ? "false" : "true"} />
        <button
          type="submit"
          className={
            job.deleted_at
              ? "min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:bg-brand-50"
              : "min-h-12 rounded-xl border-2 border-red-200 bg-white px-5 font-semibold text-red-800 hover:border-red-400 hover:bg-red-50"
          }
        >
          {job.deleted_at ? j.restoreAction : j.deleteAction}
        </button>
        {!job.deleted_at ? <p className="mt-2 text-xs text-slate-500">{j.deleteConfirm}</p> : null}
      </form>
    </div>
  );
}
