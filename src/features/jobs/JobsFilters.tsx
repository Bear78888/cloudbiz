import Link from "next/link";

import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import {
  JOB_PRIORITIES,
  JOB_SORTS,
  JOB_STATUSES,
  JOB_VIEWS,
  MAX_SEARCH_LENGTH,
  type JobSort,
  type JobView,
} from "./model";

/**
 * Views, search and filters (§13.7, §13.8) as a plain GET form: the state
 * lives in the URL, so a filtered list is shareable, survives a reload and
 * works before JavaScript arrives.
 */

export interface JobsQueryState {
  view: JobView;
  sort: JobSort;
  q: string;
  status: string;
  priority: string;
  assigned: string;
  deleted: boolean;
}

export function buildJobsHref(
  locale: Locale,
  state: Partial<JobsQueryState> & { page?: number },
): string {
  const params = new URLSearchParams();
  if (state.view && state.view !== "all_jobs") params.set("view", state.view);
  if (state.sort && state.sort !== "newest") params.set("sort", state.sort);
  if (state.q) params.set("q", state.q);
  if (state.status) params.set("status", state.status);
  if (state.priority) params.set("priority", state.priority);
  if (state.assigned) params.set("assigned", state.assigned);
  if (state.deleted) params.set("deleted", "1");
  if (state.page && state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  return `/${locale}/app/jobs${query ? `?${query}` : ""}`;
}

const selectClass =
  "min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function JobsFilters({
  locale,
  dict,
  state,
  members,
  deletedCount,
}: {
  locale: Locale;
  dict: Dict;
  state: JobsQueryState;
  members: { id: string; label: string }[];
  deletedCount: number;
}) {
  const j = dict.platform.jobs;
  const hasFilters = Boolean(state.q || state.status || state.priority || state.assigned);

  return (
    <div className="space-y-4">
      {/* Views (§13.7) — horizontally scrollable on a phone rather than wrapped. */}
      <nav aria-label={j.filters} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {JOB_VIEWS.map((view) => {
            const active = !state.deleted && state.view === view;
            return (
              <li key={view}>
                <Link
                  href={buildJobsHref(locale, { ...state, view, deleted: false, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {j.views[view]}
                </Link>
              </li>
            );
          })}
          {deletedCount > 0 ? (
            <li>
              <Link
                href={buildJobsHref(locale, { ...state, deleted: true, page: 1 })}
                aria-current={state.deleted ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
                  state.deleted
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {j.deletedFilter} ({deletedCount})
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-3">
        {state.view !== "all_jobs" ? <input type="hidden" name="view" value={state.view} /> : null}
        {state.deleted ? <input type="hidden" name="deleted" value="1" /> : null}

        <div className="min-w-0 flex-1 basis-full sm:basis-64">
          <label htmlFor="q" className="block text-sm font-semibold text-slate-700">
            {j.searchLabel}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={state.q}
            maxLength={MAX_SEARCH_LENGTH}
            placeholder={j.searchPlaceholder}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-semibold text-slate-700">
            {j.form.status}
          </label>
          <select id="status" name="status" defaultValue={state.status} className={`mt-1.5 ${selectClass}`}>
            <option value="">{j.allStatuses}</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {j.statuses[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-semibold text-slate-700">
            {j.form.priority}
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={state.priority}
            className={`mt-1.5 ${selectClass}`}
          >
            <option value="">{j.allPriorities}</option>
            {JOB_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {j.priorities[priority]}
              </option>
            ))}
          </select>
        </div>

        {members.length > 1 ? (
          <div>
            <label htmlFor="assigned" className="block text-sm font-semibold text-slate-700">
              {j.assignedTo}
            </label>
            <select
              id="assigned"
              name="assigned"
              defaultValue={state.assigned}
              className={`mt-1.5 ${selectClass}`}
            >
              <option value="">{j.allAssignees}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="sort" className="block text-sm font-semibold text-slate-700">
            {j.sortLabel}
          </label>
          <select id="sort" name="sort" defaultValue={state.sort} className={`mt-1.5 ${selectClass}`}>
            {JOB_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {j.sorts[sort]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="min-h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
        >
          {j.searchAction}
        </button>

        {hasFilters ? (
          <Link
            href={buildJobsHref(locale, { view: state.view, deleted: state.deleted })}
            className="min-h-11 self-center text-sm font-semibold text-slate-600 underline hover:text-slate-900"
          >
            {j.clearFilters}
          </Link>
        ) : null}
      </form>
    </div>
  );
}
