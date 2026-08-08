"use client";

import { useActionState, useState } from "react";

import { type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

import { EMPTY_CONTENT_ACTION_STATE, type SiteContentActionState } from "./action-state";
import { saveSiteContentAction } from "./actions";
import type { SiteTextContent } from "./model";
import {
  MAX_ABOUT,
  MAX_CTA,
  MAX_FAQ_ANSWER,
  MAX_FAQ_ITEMS,
  MAX_FAQ_QUESTION,
  MAX_HEADLINE,
  MAX_SERVICE_AREA_NOTE,
  MAX_SUBHEADLINE,
  type SiteContentField,
} from "./schema";

/**
 * What one language of the site *says* (§19.4 blocks 1, 3, 4, 7, 8).
 *
 * One language at a time, chosen on the page around this form. Editing both at
 * once would mean every save rewriting a language the owner may not have looked
 * at — and for a bilingual site that language is often a translation someone
 * else checked.
 *
 * The form is keyed on the content locale so that switching language remounts
 * it: uncontrolled inputs keep their `defaultValue` from the first render, and
 * without the key the Spanish page would open showing the English text.
 */

const inputClass =
  "block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const labelClass = "block text-sm font-semibold text-slate-700";

interface FaqRow {
  key: string;
  question: string;
  answer: string;
}

/** Two spares, so the form is usable with JavaScript switched off entirely. */
const SPARE_FAQ_ROWS = 2;

function initialFaqRows(content: SiteTextContent): FaqRow[] {
  const existing = content.faq.map((entry, index) => ({
    key: `faq-${index}`,
    question: entry.question,
    answer: entry.answer,
  }));
  const spares = Array.from({ length: SPARE_FAQ_ROWS }, (_, index) => ({
    key: `new-${index}`,
    question: "",
    answer: "",
  }));
  return [...existing, ...spares];
}

export function SiteContentForm({
  locale,
  contentLocale,
  dict,
  content,
}: {
  locale: Locale;
  contentLocale: Locale;
  dict: Dict;
  content: SiteTextContent;
}) {
  const [state, formAction, pending] = useActionState<SiteContentActionState, FormData>(
    saveSiteContentAction,
    EMPTY_CONTENT_ACTION_STATE,
  );
  const w = dict.platform.website;

  const [faqRows, setFaqRows] = useState<FaqRow[]>(() => initialFaqRows(content));

  const errorFor = (field: SiteContentField): string | undefined => {
    const code = state.errors[field];
    return code ? w.fieldErrors[code] : undefined;
  };

  const updateRow = (key: string, patch: Partial<FaqRow>) => {
    setFaqRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="content_locale" value={contentLocale} />

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
          {w.blocks.hero}
        </legend>
        <div className="grid gap-4">
          <div>
            <label htmlFor="headline" className={labelClass}>
              {w.headlineField}
            </label>
            <input
              id="headline"
              name="headline"
              type="text"
              maxLength={MAX_HEADLINE}
              defaultValue={content.headline ?? ""}
              placeholder={w.headlinePlaceholder}
              aria-invalid={state.errors.headline ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            {errorFor("headline") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("headline")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="subheadline" className={labelClass}>
              {w.subheadlineField}
              <span className="ml-1.5 font-normal text-slate-500">({w.optional})</span>
            </label>
            <input
              id="subheadline"
              name="subheadline"
              type="text"
              maxLength={MAX_SUBHEADLINE}
              defaultValue={content.subheadline ?? ""}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="cta_text" className={labelClass}>
              {w.ctaField}
              <span className="ml-1.5 font-normal text-slate-500">({w.optional})</span>
            </label>
            <input
              id="cta_text"
              name="cta_text"
              type="text"
              maxLength={MAX_CTA}
              defaultValue={content.ctaText ?? ""}
              placeholder={w.ctaPlaceholder}
              aria-describedby="cta-hint"
              className={`mt-1.5 ${inputClass}`}
            />
            <p id="cta-hint" className="mt-1 text-xs text-slate-500">
              {w.ctaHint}
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.blocks.why_choose_us}
        </legend>
        <label htmlFor="why_choose_us" className={labelClass}>
          {w.whyField}
        </label>
        <textarea
          id="why_choose_us"
          name="why_choose_us"
          rows={5}
          defaultValue={content.whyChooseUs.join("\n")}
          placeholder={w.whyPlaceholder}
          aria-describedby="why-hint"
          aria-invalid={state.errors.why_choose_us ? true : undefined}
          className={`mt-1.5 ${inputClass}`}
        />
        <p id="why-hint" className="mt-1 text-xs text-slate-500">
          {w.whyHint}
        </p>
        {errorFor("why_choose_us") ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {errorFor("why_choose_us")}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.blocks.about}
        </legend>
        <label htmlFor="about_text" className="sr-only">
          {w.aboutField}
        </label>
        <textarea
          id="about_text"
          name="about_text"
          rows={6}
          maxLength={MAX_ABOUT}
          defaultValue={content.aboutText ?? ""}
          placeholder={w.aboutPlaceholder}
          aria-describedby="about-hint"
          className={inputClass}
        />
        {/* §32.5: licences, insurance and years in business are the owner's
            claims to make. Saying so here is cheaper than finding out later
            that a template invented a credential. */}
        <p id="about-hint" className="mt-2 text-xs text-slate-500">
          {w.aboutHint}
        </p>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.blocks.service_area}
        </legend>
        <label htmlFor="service_area_note" className={labelClass}>
          {w.serviceAreaNoteField}
          <span className="ml-1.5 font-normal text-slate-500">({w.optional})</span>
        </label>
        <textarea
          id="service_area_note"
          name="service_area_note"
          rows={3}
          maxLength={MAX_SERVICE_AREA_NOTE}
          defaultValue={content.serviceAreaNote ?? ""}
          aria-describedby="service-area-hint"
          className={`mt-1.5 ${inputClass}`}
        />
        <p id="service-area-hint" className="mt-1 text-xs text-slate-500">
          {w.serviceAreaNoteHint}
        </p>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {w.blocks.faq}
        </legend>

        {errorFor("faq") ? (
          <p role="alert" className="mb-3 text-sm font-medium text-red-700">
            {errorFor("faq")}
          </p>
        ) : null}

        <ul className="space-y-4">
          {faqRows.map((row, index) => (
            <li key={row.key} className="rounded-xl border border-slate-200 p-4">
              <label
                htmlFor={`faq_question_${index}`}
                className="text-xs font-semibold text-slate-600"
              >
                {w.faqQuestionField}
              </label>
              <input
                id={`faq_question_${index}`}
                name="faq_question"
                type="text"
                maxLength={MAX_FAQ_QUESTION}
                value={row.question}
                onChange={(event) => updateRow(row.key, { question: event.target.value })}
                className={`mt-1 ${inputClass}`}
              />
              <label
                htmlFor={`faq_answer_${index}`}
                className="mt-3 block text-xs font-semibold text-slate-600"
              >
                {w.faqAnswerField}
              </label>
              <textarea
                id={`faq_answer_${index}`}
                name="faq_answer"
                rows={2}
                maxLength={MAX_FAQ_ANSWER}
                value={row.answer}
                onChange={(event) => updateRow(row.key, { answer: event.target.value })}
                className={`mt-1 ${inputClass}`}
              />
              {faqRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setFaqRows((current) => current.filter((r) => r.key !== row.key))}
                  className="mt-2 min-h-12 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-red-700"
                >
                  {w.removeFaq}
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={faqRows.length >= MAX_FAQ_ITEMS}
          onClick={() =>
            setFaqRows((current) => [
              ...current,
              { key: `new-${current.length}`, question: "", answer: "" },
            ])
          }
          className="mt-4 min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
        >
          {w.addFaq}
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? w.saving : w.saveContent}
      </button>
    </form>
  );
}
