import { formatDateTime } from "@/lib/datetime";
import { fmt, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import { isJobStatus } from "./model";
import type { JobActivityRow } from "./service";

/**
 * The activity trail (§13.11). Entries come from database triggers, so this
 * renders history rather than reconstructing it — and since the trail stores
 * field *names* only (§26.6), there is nothing here to leak.
 */

type ActivityKey = keyof Dict["platform"]["jobs"]["activity"];

function describe(activity: JobActivityRow, dict: Dict): string {
  const a = dict.platform.jobs.activity;
  const key = activity.event_type as ActivityKey;
  const template = key in a ? a[key] : null;
  if (!template) return activity.event_type;

  if (activity.event_type === "job.status_changed") {
    const from = String(activity.metadata.from ?? "");
    const to = String(activity.metadata.to ?? "");
    return fmt(template, {
      from: isJobStatus(from) ? dict.platform.jobs.statuses[from] : from,
      to: isJobStatus(to) ? dict.platform.jobs.statuses[to] : to,
    });
  }
  return template;
}

function changedFields(activity: JobActivityRow, dict: Dict): string | null {
  const fields = activity.metadata.fields;
  if (!Array.isArray(fields) || fields.length === 0) return null;
  return fmt(dict.platform.jobs.activity.changedFields, { fields: fields.join(", ") });
}

export function JobActivityFeed({
  activities,
  dict,
  locale,
  timeZone,
}: {
  activities: JobActivityRow[];
  dict: Dict;
  locale: Locale;
  timeZone: string;
}) {
  const j = dict.platform.jobs;

  if (activities.length === 0) {
    return <p className="text-sm text-slate-500">{j.detail.activityEmpty}</p>;
  }

  return (
    <ol className="space-y-4">
      {activities.map((activity) => {
        const fields = changedFields(activity, dict);
        return (
          <li key={activity.id} className="border-l-2 border-slate-200 pl-4">
            <p className="text-sm font-medium text-slate-800">{describe(activity, dict)}</p>
            {fields ? <p className="mt-0.5 text-xs text-slate-500">{fields}</p> : null}
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDateTime(activity.created_at, locale, timeZone)}
              {activity.actor_type !== "user" ? ` · ${j.activity.bySystem}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
