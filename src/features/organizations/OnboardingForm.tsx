"use client";

import { useActionState } from "react";

import { createOrganizationAction, type OnboardingActionState } from "@/features/organizations/actions";
import { US_TIMEZONES } from "@/features/organizations/constants";
import { TRADES } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

const initialState: OnboardingActionState = { error: null };

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function OnboardingForm({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);
  const o = dict.platform.onboarding;

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {state.error === "required" ? o.errorRequired : o.errorGeneric}
        </p>
      ) : null}
      <div>
        <label htmlFor="business_name" className="block text-sm font-semibold text-slate-700">
          {o.businessName}
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          maxLength={200}
          placeholder={o.businessNamePlaceholder}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="trade" className="block text-sm font-semibold text-slate-700">
          {o.trade}
        </label>
        <select id="trade" name="trade" required className={inputClass} defaultValue={TRADES[0].code}>
          {TRADES.map((trade) => (
            <option key={trade.code} value={trade.code}>
              {dict.trades.items[trade.code].name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="default_locale" className="block text-sm font-semibold text-slate-700">
          {o.language}
        </label>
        <select id="default_locale" name="default_locale" className={inputClass} defaultValue={locale}>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
      <div>
        <label htmlFor="timezone" className="block text-sm font-semibold text-slate-700">
          {o.timezone}
        </label>
        <select id="timezone" name="timezone" className={inputClass} defaultValue="America/New_York">
          {US_TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace("America/", "").replace("Pacific/", "").replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
      >
        {pending ? o.creating : o.submit}
      </button>
    </form>
  );
}
