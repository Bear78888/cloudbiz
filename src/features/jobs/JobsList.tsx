import Link from "next/link";

import { formatDateTime, formatMoney } from "@/lib/datetime";
import { fmt, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import { DeletedBadge, PaymentBadge, PriorityBadge, StatusBadge } from "./JobBadges";
import { buildJobsHref, type JobsQueryState } from "./JobsFilters";
import type { JobRow } from "./service";

/**
 * The list in two shapes (§13.9): a table on a desktop, cards on a phone.
 * The card is not a squeezed table row — it shows the five things a pro reads
 * while standing in someone's kitchen: who, what, where it stands, how much,
 * and when.
 */

function CustomerLine({ job }: { job: JobRow }) {
  return <span className="font-semibold text-slate-900">{job.customer?.name ?? "—"}</span>;
}

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
}) {
  const j = dict.platform.jobs;
  const pageSize = 25;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* Cards — the phone layout (§13.9). */}
      <ul className="space-y-3 md:hidden">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/${locale}/app/jobs/${job.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
            >
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
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p aria-live="polite">{fmt(j.showing, { from, to, total })}</p>
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
