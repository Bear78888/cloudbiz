"use client";

import { useActionState } from "react";

import { type Dict } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/routes";

import { EMPTY_LEAD_ACTION_STATE, type LeadActionState } from "./lead-action-state";
import {
  MAX_LEAD_DESCRIPTION,
  MAX_LEAD_NAME,
  MAX_LEAD_SERVICE,
  type LeadField,
} from "./lead-schema";
import { submitLeadAction } from "./public-actions";

/**
 * The contact form on a contractor's public site (§19.7).
 *
 * Written for someone standing in their kitchen holding a phone: large targets,
 * one column, and only the two questions that are actually required — a name
 * and a way to reply. Everything else is optional, because a half-filled lead
 * is still a lead and refusing it to get a tidier record loses the customer.
 *
 * Nothing about our product appears here, as everywhere else on this page.
 */

export function LeadForm({
  dict,
  locale,
  slug,
  services,
  buttonClass,
}: {
  dict: Dict;
  locale: Locale;
  slug: string;
  /** The owner's own services, so the visitor picks rather than guesses. */
  services: string[];
  buttonClass: string;
}) {
  const [state, formAction, pending] = useActionState<LeadActionState, FormData>(
    submitLeadAction,
    EMPTY_LEAD_ACTION_STATE,
  );
  const p = dict.publicSite;

  const fieldClass =
    "block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300";
  const labelClass = "block text-sm font-semibold text-slate-800";

  const errorFor = (field: LeadField): string | undefined => {
    const code = state.errors[field];
    return code ? p.leadErrors[code] : undefined;
  };

  if (state.sent) {
    return (
      <p
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-900"
      >
        {p.leadThanks}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.formError === "slow_down" ? p.leadSlowDown : p.leadError}
        </p>
      ) : null}

      <div>
        <label htmlFor="lead_name" className={labelClass}>
          {p.leadName}
        </label>
        <input
          id="lead_name"
          name="name"
          type="text"
          required
          autoComplete="name"
          maxLength={MAX_LEAD_NAME}
          aria-invalid={state.errors.name ? true : undefined}
          className={`mt-1.5 ${fieldClass}`}
        />
        {errorFor("name") ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {errorFor("name")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead_phone" className={labelClass}>
            {p.leadPhone}
          </label>
          <input
            id="lead_phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-describedby="lead-contact-hint"
            aria-invalid={state.errors.phone ? true : undefined}
            className={`mt-1.5 ${fieldClass}`}
          />
          {errorFor("phone") ? (
            <p role="alert" className="mt-1 text-sm font-medium text-red-700">
              {errorFor("phone")}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="lead_email" className={labelClass}>
            {p.leadEmail}
          </label>
          <input
            id="lead_email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={state.errors.email ? true : undefined}
            className={`mt-1.5 ${fieldClass}`}
          />
          {errorFor("email") ? (
            <p role="alert" className="mt-1 text-sm font-medium text-red-700">
              {errorFor("email")}
            </p>
          ) : null}
        </div>
      </div>
      <p id="lead-contact-hint" className="text-xs text-slate-600">
        {p.leadContactHint}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead_service" className={labelClass}>
            {p.leadService}
          </label>
          {/* A list when the business has one, a box when it does not: guessing
              the wording of someone else's trade is how a lead arrives
              describing a service nobody offers. */}
          {services.length > 0 ? (
            <select id="lead_service" name="service" className={`mt-1.5 ${fieldClass}`}>
              <option value="">{p.leadServiceAny}</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="lead_service"
              name="service"
              type="text"
              maxLength={MAX_LEAD_SERVICE}
              className={`mt-1.5 ${fieldClass}`}
            />
          )}
        </div>
        <div>
          <label htmlFor="lead_zip" className={labelClass}>
            {p.leadZip}
          </label>
          <input
            id="lead_zip"
            name="zip"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={16}
            className={`mt-1.5 ${fieldClass}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="lead_description" className={labelClass}>
          {p.leadDescription}
        </label>
        <textarea
          id="lead_description"
          name="description"
          rows={4}
          maxLength={MAX_LEAD_DESCRIPTION}
          className={`mt-1.5 ${fieldClass}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead_date" className={labelClass}>
            {p.leadPreferredDate}
          </label>
          <input id="lead_date" name="preferred_date" type="date" className={`mt-1.5 ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="lead_locale" className={labelClass}>
            {p.leadLanguage}
          </label>
          <select
            id="lead_locale"
            name="preferred_locale"
            defaultValue={locale}
            className={`mt-1.5 ${fieldClass}`}
          >
            {LOCALES.map((option) => (
              <option key={option} value={option}>
                {p.localeNames[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/*
        A field nobody sees and a bot fills in anyway. `hidden` rather than
        off-screen text, and never announced: a screen reader user must not be
        offered a trap.
      */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />

      <div>
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input
            type="checkbox"
            name="consent"
            value="yes"
            required
            aria-invalid={state.errors.consent ? true : undefined}
            className="mt-1 size-5 rounded border-slate-400"
          />
          {/* §19.7's consent box. Consent to be contacted about *this* enquiry —
              deliberately not SMS marketing consent (§17.9), which this form
              never collects and nothing here infers. */}
          <span>{p.leadConsent}</span>
        </label>
        {errorFor("consent") ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {errorFor("consent")}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-12 items-center rounded-xl px-6 font-semibold disabled:opacity-60 ${buttonClass}`}
      >
        {pending ? p.leadSending : p.leadSubmit}
      </button>
    </form>
  );
}
