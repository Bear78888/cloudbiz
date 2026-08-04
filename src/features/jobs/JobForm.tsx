"use client";

import Link from "next/link";
import { useActionState } from "react";

import { isoToZonedInput } from "@/lib/datetime";
import { fmt, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import { EMPTY_JOB_ACTION_STATE, type JobActionState } from "./action-state";
import { saveJobAction } from "./actions";
import {
  CUSTOMER_LOCALES,
  JOB_PRIORITIES,
  JOB_STATUSES,
  LEAD_SOURCES,
  PAYMENT_STATUSES,
} from "./model";
import type { JobFormField } from "./schema";
import type { JobRow } from "./service";

/**
 * One form for adding and editing (§13.8). The order is the order a pro thinks
 * in: who called, what they need, when, what it costs. Only the customer name
 * and the job need filling in — §13.11 asks for a first record in under a
 * minute, and that is only true if nothing else is mandatory.
 */

const inputClass =
  "mt-1.5 block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const labelClass = "block text-sm font-semibold text-slate-700";

function Field({
  id,
  label,
  optional,
  error,
  dict,
  children,
  hint,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  dict: Dict;
  children: React.ReactNode;
  hint?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal text-slate-500">
            ({dict.platform.jobs.form.optional})
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
      <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function JobForm({
  locale,
  dict,
  timeZone,
  members,
  job,
}: {
  locale: Locale;
  dict: Dict;
  timeZone: string;
  members: { id: string; label: string }[];
  job?: JobRow;
}) {
  const [state, formAction, pending] = useActionState<JobActionState, FormData>(
    saveJobAction,
    EMPTY_JOB_ACTION_STATE,
  );
  const j = dict.platform.jobs;
  const f = j.form;

  const errorFor = (field: JobFormField): string | undefined => {
    const code = state.errors[field];
    return code ? j.fieldErrors[code] : undefined;
  };
  const invalid = (field: JobFormField) => (state.errors[field] ? true : undefined);

  const cancelHref = job ? `/${locale}/app/jobs/${job.id}` : `/${locale}/app/jobs`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {job ? <input type="hidden" name="job_id" value={job.id} /> : null}

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.formError === "not_found" ? f.notFoundError : f.genericError}
        </p>
      ) : null}
      {Object.keys(state.errors).length > 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          {f.fixErrors}
        </p>
      ) : null}

      <Section title={f.customerSection}>
        <Field id="customer_name" label={f.customerName} error={errorFor("customer_name")} dict={dict}>
          <input
            id="customer_name"
            name="customer_name"
            type="text"
            required
            maxLength={200}
            autoComplete="off"
            aria-invalid={invalid("customer_name")}
            defaultValue={job?.customer?.name ?? ""}
            placeholder={f.customerNamePlaceholder}
            className={inputClass}
          />
        </Field>

        <Field id="customer_phone" label={f.phone} optional error={errorFor("customer_phone")} dict={dict}>
          <input
            id="customer_phone"
            name="customer_phone"
            type="tel"
            inputMode="tel"
            maxLength={40}
            autoComplete="off"
            aria-invalid={invalid("customer_phone")}
            defaultValue={job?.customer?.phone ?? ""}
            className={inputClass}
          />
        </Field>

        <Field id="customer_email" label={f.email} optional error={errorFor("customer_email")} dict={dict}>
          <input
            id="customer_email"
            name="customer_email"
            type="email"
            maxLength={200}
            autoComplete="off"
            aria-invalid={invalid("customer_email")}
            defaultValue={job?.customer?.email ?? ""}
            className={inputClass}
          />
        </Field>

        <Field id="customer_locale" label={f.preferredLanguage} dict={dict}>
          <select
            id="customer_locale"
            name="customer_locale"
            defaultValue={job?.customer?.preferred_locale ?? "en"}
            className={inputClass}
          >
            {CUSTOMER_LOCALES.map((code) => (
              <option key={code} value={code}>
                {code === "en" ? "English" : "Español"}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <input
              type="checkbox"
              name="sms_consent"
              defaultChecked={job?.customer?.sms_consent ?? false}
              className="mt-0.5 h-5 w-5 rounded border-slate-400 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">{f.smsConsent}</span>
              <span className="mt-0.5 block text-xs text-slate-600">{f.smsConsentHint}</span>
            </span>
          </label>
        </div>
      </Section>

      <Section title={f.jobSection}>
        <Field id="title" label={f.jobTitle} error={errorFor("title")} dict={dict}>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={200}
            aria-invalid={invalid("title")}
            defaultValue={job?.title ?? ""}
            placeholder={f.jobTitlePlaceholder}
            className={inputClass}
          />
        </Field>

        <Field id="service" label={f.service} optional error={errorFor("service")} dict={dict}>
          <input
            id="service"
            name="service"
            type="text"
            maxLength={200}
            defaultValue={job?.service ?? ""}
            placeholder={f.servicePlaceholder}
            className={inputClass}
          />
        </Field>

        <Field id="status" label={f.status} dict={dict}>
          <select id="status" name="status" defaultValue={job?.status ?? "new_lead"} className={inputClass}>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {j.statuses[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="priority" label={f.priority} dict={dict}>
          <select
            id="priority"
            name="priority"
            defaultValue={job?.priority ?? "normal"}
            className={inputClass}
          >
            {JOB_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {j.priorities[priority]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="source" label={f.leadSource} optional dict={dict}>
          <select id="source" name="source" defaultValue={job?.source ?? ""} className={inputClass}>
            <option value="">{f.leadSourceNone}</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {j.leadSources[source]}
              </option>
            ))}
          </select>
        </Field>

        {members.length > 1 ? (
          <Field id="assigned_user_id" label={f.assignedTo} optional dict={dict}>
            <select
              id="assigned_user_id"
              name="assigned_user_id"
              defaultValue={job?.assigned_user_id ?? ""}
              className={inputClass}
            >
              <option value="">{j.unassigned}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <div className="sm:col-span-2">
          <Field id="address" label={f.address} optional error={errorFor("address")} dict={dict}>
            <input
              id="address"
              name="address"
              type="text"
              maxLength={400}
              autoComplete="off"
              defaultValue={job?.address ?? ""}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field id="description" label={f.description} optional error={errorFor("description")} dict={dict}>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={5000}
              defaultValue={job?.description ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title={f.scheduleSection}>
        <Field
          id="scheduled_start"
          label={f.scheduledStart}
          optional
          error={errorFor("scheduled_start")}
          dict={dict}
          hint={fmt(f.timezoneHint, { timezone: timeZone })}
        >
          <input
            id="scheduled_start"
            name="scheduled_start"
            type="datetime-local"
            aria-invalid={invalid("scheduled_start")}
            defaultValue={isoToZonedInput(job?.scheduled_start, timeZone)}
            className={inputClass}
          />
        </Field>

        <Field
          id="scheduled_end"
          label={f.scheduledEnd}
          optional
          error={errorFor("scheduled_end")}
          dict={dict}
        >
          <input
            id="scheduled_end"
            name="scheduled_end"
            type="datetime-local"
            aria-invalid={invalid("scheduled_end")}
            defaultValue={isoToZonedInput(job?.scheduled_end, timeZone)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title={f.moneySection}>
        <Field
          id="estimate_amount"
          label={f.estimateAmount}
          optional
          error={errorFor("estimate_amount")}
          dict={dict}
        >
          <input
            id="estimate_amount"
            name="estimate_amount"
            type="text"
            inputMode="decimal"
            aria-invalid={invalid("estimate_amount")}
            defaultValue={job?.estimate_amount ?? ""}
            className={inputClass}
          />
        </Field>

        <Field id="job_total" label={f.jobTotal} optional error={errorFor("job_total")} dict={dict}>
          <input
            id="job_total"
            name="job_total"
            type="text"
            inputMode="decimal"
            aria-invalid={invalid("job_total")}
            defaultValue={job?.job_total ?? ""}
            className={inputClass}
          />
        </Field>

        <Field
          id="materials_cost"
          label={f.materialsCost}
          optional
          error={errorFor("materials_cost")}
          dict={dict}
        >
          <input
            id="materials_cost"
            name="materials_cost"
            type="text"
            inputMode="decimal"
            aria-invalid={invalid("materials_cost")}
            defaultValue={job?.materials_cost ?? ""}
            className={inputClass}
          />
        </Field>

        <Field id="payment_status" label={f.paymentStatus} dict={dict}>
          <select
            id="payment_status"
            name="payment_status"
            defaultValue={job?.payment_status ?? "unpaid"}
            className={inputClass}
          >
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {j.paymentStatuses[status]}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={f.notesSection}>
        <div className="sm:col-span-2">
          <Field id="notes" label={f.notes} optional error={errorFor("notes")} dict={dict}>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={job?.notes ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? f.saving : f.save}
        </button>
        <Link href={cancelHref} className="min-h-12 font-semibold text-slate-600 hover:text-slate-900">
          {f.cancel}
        </Link>
      </div>
      <p className="text-xs text-slate-500">{j.voiceDeferred}</p>
    </form>
  );
}
