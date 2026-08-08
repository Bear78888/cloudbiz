"use client";

import { useActionState, useState } from "react";

import { type Dict } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/routes";

import { EMPTY_SETTINGS_ACTION_STATE, type SiteSettingsActionState } from "./action-state";
import { saveSiteSettingsAction } from "./actions";
import {
  OPTIONAL_BLOCKS,
  SITE_COLOR_PRESETS,
  SITE_TEMPLATES,
  slugify,
  type SiteColorPreset,
  type SiteTemplate,
} from "./model";
import type { SiteSettingsField } from "./schema";

/**
 * What the site *is*: its address, its template, its colours, its languages and
 * which of the §19.4 blocks it carries.
 *
 * The address preview is built with the same `slugify` the suggestion uses and
 * the same rule the database enforces, so what the owner sees under the field
 * is the address they will actually get — a preview computed a second way is a
 * preview that eventually lies.
 */

const inputClass =
  "block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const labelClass = "block text-sm font-semibold text-slate-700";

export function SiteSettingsForm({
  locale,
  dict,
  baseUrl,
  site,
  slug,
  suggestedFrom,
  locales,
}: {
  locale: Locale;
  dict: Dict;
  /** Null when the deployment's own address could not be resolved (see app-url). */
  baseUrl: string | null;
  site: { template: SiteTemplate; colorPreset: SiteColorPreset; hiddenBlocks: string[] };
  slug: string | null;
  /** The business name, used to fill the address in for someone who has none yet. */
  suggestedFrom: string;
  locales: readonly Locale[];
}) {
  const [state, formAction, pending] = useActionState<SiteSettingsActionState, FormData>(
    saveSiteSettingsAction,
    EMPTY_SETTINGS_ACTION_STATE,
  );
  const w = dict.platform.website;

  const [slugInput, setSlugInput] = useState(() => slug ?? slugify(suggestedFrom));

  const errorFor = (field: SiteSettingsField): string | undefined => {
    const code = state.errors[field];
    return code ? w.fieldErrors[code] : undefined;
  };

  const hidden = new Set(site.hiddenBlocks);
  const preview = slugInput.trim() === "" ? null : `${baseUrl ?? ""}/pro/${slugInput.trim()}`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.formError === "not_owner" ? w.notOwnerError : w.genericError}
        </p>
      ) : null}
      {state.saved ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {w.savedNotice}
        </p>
      ) : null}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.addressSection}
        </legend>

        <label htmlFor="slug" className={labelClass}>
          {w.addressField}
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          maxLength={63}
          value={slugInput}
          onChange={(event) => setSlugInput(event.target.value)}
          aria-describedby="slug-hint"
          aria-invalid={state.errors.slug ? true : undefined}
          className={`mt-1.5 ${inputClass}`}
        />
        <p id="slug-hint" className="mt-1 text-xs text-slate-500">
          {w.addressHint}
          {preview ? (
            <>
              {" "}
              <span className="font-mono text-slate-700">{preview}</span>
            </>
          ) : null}
        </p>
        {errorFor("slug") ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {errorFor("slug")}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.lookSection}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="template" className={labelClass}>
              {w.templateField}
            </label>
            <select
              id="template"
              name="template"
              defaultValue={site.template}
              className={`mt-1.5 ${inputClass}`}
            >
              {SITE_TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {w.templates[template]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="color_preset" className={labelClass}>
              {w.colorField}
            </label>
            <select
              id="color_preset"
              name="color_preset"
              defaultValue={site.colorPreset}
              className={`mt-1.5 ${inputClass}`}
            >
              {SITE_COLOR_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {w.colors[preset]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{w.lookHint}</p>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.languagesSection}
        </legend>
        <p className="text-sm text-slate-600">{w.languagesHint}</p>
        <ul className="mt-3 space-y-2">
          {LOCALES.map((siteLocale) => (
            <li key={siteLocale}>
              <label className="flex min-h-12 items-center gap-3 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  name="site_locale"
                  value={siteLocale}
                  defaultChecked={locales.includes(siteLocale)}
                  className="size-5 rounded border-slate-300"
                />
                {w.localeNames[siteLocale]}
              </label>
            </li>
          ))}
        </ul>
        {errorFor("locales") ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {errorFor("locales")}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.blocksSection}
        </legend>
        <p className="text-sm text-slate-600">{w.blocksHint}</p>
        <ul className="mt-3 space-y-2">
          {OPTIONAL_BLOCKS.map((block) => (
            <li key={block}>
              <label className="flex min-h-12 items-center gap-3 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  name="visible_block"
                  value={block}
                  defaultChecked={!hidden.has(block)}
                  className="size-5 rounded border-slate-300"
                />
                {w.blocks[block]}
              </label>
            </li>
          ))}
        </ul>
        {/* The three blocks that are not a choice, named rather than silently
            absent: an owner looking for "Photos" in this list should find out
            why it is not here instead of concluding the list is incomplete. */}
        <p className="mt-3 text-xs text-slate-500">
          {w.blocksAlwaysOn}: {w.blocks.hero}, {w.blocks.footer}. {w.galleryComingSoon}
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? w.saving : w.saveSettings}
      </button>
    </form>
  );
}
