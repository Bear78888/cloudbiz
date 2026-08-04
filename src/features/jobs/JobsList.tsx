import Link from "next/link";

import { formatDateTime, formatMoney } from "@/lib/datetime";
import { fmt, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import { changeJobsStatusAction } from "./actions";
import { DeletedBadge, PaymentBadge, PriorityBadge, StatusBadge } from "./JobBadges";
import { buildJobsHref, type JobsQueryState } from "./JobsFilters";
import { JOB_STATUSES } from "./model";
import { SelectAllJobs } from "./SelectAllJobs";
import type { JobRow } from "./service";

/**
 * The list in two shapes (§13.9): a table on a desktop, cards on a phone.
 * The card is not a squeezed table row — it shows the five things a pro reads
 * while standing in someone's kitchen: who, what, where it stands, how much,
 * and when.
 *
 * The whole list is one form, so the bulk status change (§13.8) is ordinary
 * checkboxes and a submit button: it works before JavaScript loads, and the
 * selection survives nothing being clicked twice.
 */

function CustomerLine({ job }: { job: JobRow }) {
  return <span className="font-semibold text-slate-900">{job.customer?.name ?? "—"}</span>;
}

const checkboxClass =
  "h-5 w-5 shrink-0 rounded border-slate-400 text-brand-600 focus:ring-brand-500";

export function JobsList({
  jobs,
  locale,
  dict,
  timeZone,
  currency,
  state,
  total,
  page,
  pageCount,
  returnTo,
}: {
  jobs: JobRow[];
  locale: Locale;
  dict: Dict;
  timeZone: string;
  currency: string;
  state: JobsQueryState;
  total: number;
  page: number;
  pageCount: number;
  /** Current list URL — the bulk action returns here, filters intact. */
  returnTo: string;
}) {
  const j = dict.platform.jobs;
  const pageSize = 25;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <form action={changeJobsStatusAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="return_to" value={returnTo} />

        {/* Cards — the phone layout (§13.9). */}
        <ul className="space-y-3 md:hidden">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <input
                type="checkbox"
                name="job_ids"
                value={job.id}
                aria-label={fmt(j.bulk.selectJob, { job: job.title })}
                className={`${checkboxClass} mt-1`}
              />
              <Link href={`/${locale}/app/jobs/${job.id}`} className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <CustomerLine job={job} />
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {job.deleted_at ? <DeletedBadge dict={dict} /> : null}
                    <PriorityBadge priority={job.priority} dict={dict} />
                  </div>
                </div>
                <p className="mt-1 text-slate-700">{job.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={job.status} dict={dict} />
                  {job.job_total !== null ? (
                    <span className="font-semibold text-slate-900">
                      {formatMoney(job.job_total, locale, currency)}
                    </span>
                  ) : null}
                </div>
                {job.scheduled_start ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {formatDateTime(job.scheduled_start, locale, timeZone)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        {/* Table — the desktop layout. */}
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
          <table className="w-full min-w-[54rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <span className="sr-only">{j.bulk.selectColumn}</span>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">{j.table.customer}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{j.table.job}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{j.table.status}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{j.table.scheduled}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{j.table.total}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">{j.table.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      name="job_ids"
                      value={job.id}
                      aria-label={fmt(j.bulk.selectJob, { job: job.title })}
                      className={checkboxClass}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <CustomerLine job={job} />
                    {job.customer?.phone ? (
                      <p className="text-xs text-slate-500">{job.customer.phone}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-slate-800">{job.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {job.service ? (
                        <span className="text-xs text-slate-500">{job.service}</span>
                      ) : null}
                      <PriorityBadge priority={job.priority} dict={dict} />
                      {job.deleted_at ? <DeletedBadge dict={dict} /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge status={job.status} dict={dict} />
                      <PaymentBadge status={job.payment_status} dict={dict} />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">
                    {job.scheduled_start
                      ? formatDateTime(job.scheduled_start, locale, timeZone)
                      : j.detail.noSchedule}
                  </td>
                  <td className="px-4 py-3 align-top text-right font-semibold text-slate-900">
                    {job.job_total !== null
                      ? formatMoney(job.job_total, locale, currency)
                      : j.detail.noAmount}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <Link
                      href={`/${locale}/app/jobs/${job.id}`}
                      className="font-semibold text-brand-700 underline hover:text-brand-900"
                    >
                      {j.table.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bulk status change (§13.8). Deleted jobs are restored, not restatused. */}
        {!state.deleted ? (
          <section
            aria-label={j.bulk.title}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="basis-full sm:basis-auto">
              <SelectAllJobs label={j.bulk.selectAll} />
            </div>
            <div>
              <label htmlFor="bulk-status" className="block text-sm font-semibold text-slate-700">
                {j.bulk.title}
              </label>
              <select
                id="bulk-status"
                name="status"
                defaultValue="scheduled"
                className="mt-1.5 min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
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
              className="min-h-11 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
            >
              {j.bulk.apply}
            </button>
            <p className="basis-full text-xs text-slate-500">{j.bulk.hint}</p>
          </section>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p aria-live="polite">
          {fmt(j.showing, { from, to, total })}
          {" · "}
          {/* Export honours the current view and search (§13.8). */}
          <a
            href={`/${locale}/app/jobs/export?view=${state.view}&sort=${state.sort}${
              state.q ? `&q=${encodeURIComponent(state.q)}` : ""
            }`}
            className="font-semibold text-brand-700 underline hover:text-brand-900"
          >
            {j.exportAction}
          </a>
        </p>
        {pageCount > 1 ? (
          <nav aria-label={fmt(j.pageOf, { page, pages: pageCount })} className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildJobsHref(locale, { ...state, page: page - 1 })}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
              >
                {j.previousPage}
              </Link>
            ) : null}
            <span>{fmt(j.pageOf, { page, pages: pageCount })}</span>
            {page < pageCount ? (
              <Link
                href={buildJobsHref(locale, { ...state, page: page + 1 })}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
              >
                {j.nextPage}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
