"use client";

import { useActionState, useState } from "react";

import { type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

import { EMPTY_PROFILE_ACTION_STATE, type ProfileActionState } from "./action-state";
import { saveProfileAction } from "./actions";
import { DAYS, presetsForTrade, serviceLabel, type BusinessService, type Day } from "./model";
import { MAX_SERVICES, MAX_SERVICE_NAME, type ProfileField } from "./schema";
import type { BusinessProfile } from "./service";

/**
 * The business profile (§10.2 steps 3–5): who to call, where they work, when
 * they work, and what they do.
 *
 * These are the facts the website renders from (§19.10) and the ones §19.8
 * forbids inventing, so every field on this screen is something the owner
 * types about their own business. Nothing is filled in for them — the service
 * presets are suggestions that write nothing until one is chosen.
 */

const inputClass =
  "block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const labelClass = "block text-sm font-semibold text-slate-700";

interface ServiceRow {
  key: string;
  en: string;
  es: string;
}

function initialServices(profile: BusinessProfile): ServiceRow[] {
  return profile.services.map((service, index) => ({
    key: `service-${index}`,
    en: service.name.en ?? "",
    es: service.name.es ?? "",
  }));
}

export function BusinessProfileForm({
  locale,
  dict,
  profile,
  trade,
}: {
  locale: Locale;
  dict: Dict;
  profile: BusinessProfile;
  trade: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    saveProfileAction,
    EMPTY_PROFILE_ACTION_STATE,
  );
  const b = dict.platform.businessProfile;

  const [services, setServices] = useState<ServiceRow[]>(() => initialServices(profile));
  const [openDays, setOpenDays] = useState<Set<Day>>(
    () => new Set(DAYS.filter((day) => Boolean(profile.businessHours[day]))),
  );

  // Spanish service names are only asked for when the business offers a Spanish
  // site. When they are not asked for, whatever is stored still travels back in
  // a hidden field — a business that drops Spanish for a season must not find
  // its Spanish service names deleted when it picks Spanish up again.
  const asksSpanish = profile.supportedLocales.includes("es");

  const errorFor = (field: ProfileField): string | undefined => {
    const code = state.errors[field];
    return code ? b.fieldErrors[code] : undefined;
  };

  const updateService = (key: string, patch: Partial<ServiceRow>) => {
    setServices((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addService = (preset?: BusinessService) => {
    setServices((current) => [
      ...current,
      {
        key: `new-${current.length}-${preset ? serviceLabel(preset, "en") : "blank"}`,
        en: preset?.name.en ?? "",
        es: preset?.name.es ?? "",
      },
    ]);
  };

  const chosen = new Set(services.map((row) => row.en.trim().toLowerCase()).filter(Boolean));
  const presets = presetsForTrade(trade).filter(
    (preset) => !chosen.has((preset.name.en ?? "").toLowerCase()),
  );

  const toggleDay = (day: Day, open: boolean) => {
    setOpenDays((current) => {
      const next = new Set(current);
      if (open) next.add(day);
      else next.delete(day);
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.formError === "not_owner" ? b.notOwnerError : b.genericError}
        </p>
      ) : null}
      {state.saved ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {b.savedNotice}
        </p>
      ) : null}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {b.contactSection}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner_name" className={labelClass}>
              {b.ownerNameField}
              <span className="ml-1.5 font-normal text-slate-500">({b.optional})</span>
            </label>
            <input
              id="owner_name"
              name="owner_name"
              type="text"
              maxLength={120}
              defaultValue={profile.ownerName ?? ""}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              {b.phoneField}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={profile.phone ?? ""}
              aria-describedby="phone-hint"
              aria-invalid={state.errors.phone ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            <p id="phone-hint" className="mt-1 text-xs text-slate-500">
              {b.phoneHint}
            </p>
            {errorFor("phone") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("phone")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              {b.emailField}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={profile.email ?? ""}
              aria-invalid={state.errors.email ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            {errorFor("email") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("email")}
              </p>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {b.areaSection}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="zip_codes" className={labelClass}>
              {b.zipField}
            </label>
            <textarea
              id="zip_codes"
              name="zip_codes"
              rows={4}
              defaultValue={profile.serviceArea.zipCodes.join("\n")}
              placeholder="78701"
              aria-describedby="zip-hint"
              aria-invalid={state.errors.zip_codes ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            <p id="zip-hint" className="mt-1 text-xs text-slate-500">
              {b.listHint}
            </p>
            {errorFor("zip_codes") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("zip_codes")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="cities" className={labelClass}>
              {b.citiesField}
            </label>
            <textarea
              id="cities"
              name="cities"
              rows={4}
              defaultValue={profile.serviceArea.cities.join("\n")}
              aria-describedby="cities-hint"
              aria-invalid={state.errors.cities ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            <p id="cities-hint" className="mt-1 text-xs text-slate-500">
              {b.listHint}
            </p>
            {errorFor("cities") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("cities")}
              </p>
            ) : null}
          </div>
        </div>
        {/* §19.8: an area nobody typed is not an area we may put on a page. */}
        <p className="mt-3 text-xs text-slate-500">{b.areaHint}</p>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {b.hoursSection}
        </legend>

        {errorFor("hours") ? (
          <p role="alert" className="mb-3 text-sm font-medium text-red-700">
            {errorFor("hours")}
          </p>
        ) : null}

        <ul className="space-y-3">
          {DAYS.map((day) => {
            const isOpen = openDays.has(day);
            const stored = profile.businessHours[day];
            return (
              <li key={day} className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr] sm:items-center">
                <label className="flex min-h-12 items-center gap-3 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    name="open_day"
                    value={day}
                    checked={isOpen}
                    onChange={(event) => toggleDay(day, event.target.checked)}
                    className="size-5 rounded border-slate-300"
                  />
                  {b.days[day]}
                </label>
                <div>
                  <label htmlFor={`open_${day}`} className="sr-only">
                    {`${b.days[day]} — ${b.opensAt}`}
                  </label>
                  <input
                    id={`open_${day}`}
                    name={`open_${day}`}
                    type="time"
                    disabled={!isOpen}
                    defaultValue={stored?.open ?? "08:00"}
                    className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                  />
                </div>
                <div>
                  <label htmlFor={`close_${day}`} className="sr-only">
                    {`${b.days[day]} — ${b.closesAt}`}
                  </label>
                  <input
                    id={`close_${day}`}
                    name={`close_${day}`}
                    type="time"
                    disabled={!isOpen}
                    defaultValue={stored?.close ?? "17:00"}
                    className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-slate-500">{b.hoursHint}</p>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {b.servicesSection}
        </legend>

        {errorFor("services") ? (
          <p role="alert" className="mb-3 text-sm font-medium text-red-700">
            {errorFor("services")}
          </p>
        ) : null}

        {services.length === 0 ? (
          <p className="text-sm text-slate-600">{b.servicesEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {services.map((row, index) => (
              <li key={row.key} className="rounded-xl border border-slate-200 p-4">
                <div className={asksSpanish ? "grid gap-3 sm:grid-cols-2" : ""}>
                  <div>
                    <label
                      htmlFor={`service_name_en_${index}`}
                      className="text-xs font-semibold text-slate-600"
                    >
                      {asksSpanish ? b.serviceNameEn : b.serviceName}
                    </label>
                    <input
                      id={`service_name_en_${index}`}
                      name="service_name_en"
                      type="text"
                      maxLength={MAX_SERVICE_NAME}
                      value={row.en}
                      onChange={(event) => updateService(row.key, { en: event.target.value })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  {asksSpanish ? (
                    <div>
                      <label
                        htmlFor={`service_name_es_${index}`}
                        className="text-xs font-semibold text-slate-600"
                      >
                        {b.serviceNameEs}
                      </label>
                      <input
                        id={`service_name_es_${index}`}
                        name="service_name_es"
                        type="text"
                        maxLength={MAX_SERVICE_NAME}
                        value={row.es}
                        onChange={(event) => updateService(row.key, { es: event.target.value })}
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  ) : (
                    // Carried, not shown. See `asksSpanish` above.
                    <input type="hidden" name="service_name_es" value={row.es} />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setServices((c) => c.filter((r) => r.key !== row.key))}
                  className="mt-2 min-h-12 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-red-700"
                >
                  {b.removeService}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={services.length >= MAX_SERVICES}
          onClick={() => addService()}
          className="mt-4 min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
        >
          {b.addService}
        </button>

        {/* §10.2 step 4: suggestions for the trade. They write nothing until
            one is pressed, and every one can be renamed or removed after. */}
        {presets.length > 0 && services.length < MAX_SERVICES ? (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-600">{b.presetsTitle}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <li key={preset.name.en}>
                  <button
                    type="button"
                    onClick={() => addService(preset)}
                    className="min-h-12 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50"
                  >
                    + {serviceLabel(preset, locale)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {b.reviewsSection}
        </legend>
        <label htmlFor="google_review_url" className={labelClass}>
          {b.reviewUrlField}
          <span className="ml-1.5 font-normal text-slate-500">({b.optional})</span>
        </label>
        <input
          id="google_review_url"
          name="google_review_url"
          type="url"
          defaultValue={profile.googleReviewUrl ?? ""}
          placeholder="https://g.page/r/..."
          aria-describedby="review-hint"
          aria-invalid={state.errors.google_review_url ? true : undefined}
          className={`mt-1.5 ${inputClass}`}
        />
        <p id="review-hint" className="mt-1 text-xs text-slate-500">
          {b.reviewUrlHint}
        </p>
        {errorFor("google_review_url") ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {errorFor("google_review_url")}
          </p>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? b.saving : b.save}
      </button>
    </form>
  );
}
