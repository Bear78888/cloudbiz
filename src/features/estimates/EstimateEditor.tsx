"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { formatMoney } from "@/lib/datetime";
import { type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

import { EMPTY_ESTIMATE_ACTION_STATE, type EstimateActionState } from "./action-state";
import { saveEstimateAction } from "./actions";
import {
  ESTIMATE_ITEM_TYPES,
  computeTotals,
  signedUnitPrice,
  unitPriceForEditing,
  type EstimateItemType,
} from "./model";
import { MAX_LINE_ITEMS, parseLineAmount, parseTaxRatePercent, type EstimateFormField } from "./schema";
import type { EstimateDetail } from "./service";

/**
 * The line-item editor (§16.4).
 *
 * The running total is computed with `computeTotals` — the same function the
 * server stores from. Two implementations of the arithmetic would eventually
 * disagree, and the place that would surface is a customer being shown one
 * price and charged another.
 *
 * Rows are controlled inputs so that removing one is a state change rather than
 * a DOM trick; React renders their values into the HTML, so the form still
 * submits correctly if it is used before hydration.
 */

const inputClass =
  "block w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const labelClass = "block text-sm font-semibold text-slate-700";

interface Row {
  key: string;
  itemType: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

/** Three spares, so the form is usable with JavaScript switched off entirely. */
const SPARE_ROWS = 3;

function blankRow(index: number): Row {
  return { key: `new-${index}`, itemType: "labor", description: "", quantity: "1", unitPrice: "" };
}

function initialRows(estimate: EstimateDetail): Row[] {
  const existing = estimate.items.map((item) => ({
    key: item.id,
    itemType: item.itemType,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: String(unitPriceForEditing(item.itemType, item.unitPrice)),
  }));
  return [...existing, ...Array.from({ length: SPARE_ROWS }, (_, index) => blankRow(index))];
}

export function EstimateEditor({
  locale,
  dict,
  currency,
  estimate,
  jobId,
}: {
  locale: Locale;
  dict: Dict;
  currency: string;
  estimate: EstimateDetail;
  jobId: string;
}) {
  const [state, formAction, pending] = useActionState<EstimateActionState, FormData>(
    saveEstimateAction,
    EMPTY_ESTIMATE_ACTION_STATE,
  );
  const e = dict.platform.estimates;

  const [rows, setRows] = useState<Row[]>(() => initialRows(estimate));
  const [taxRateInput, setTaxRateInput] = useState(() =>
    estimate.taxRate > 0 ? String(Math.round(estimate.taxRate * 10000) / 100) : "",
  );

  const errorFor = (field: EstimateFormField): string | undefined => {
    const code = state.errors[field];
    return code ? e.fieldErrors[code] : undefined;
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const preview = computeTotals(
    rows
      .filter((row) => row.description.trim() !== "")
      .map((row) => {
        const itemType = (
          (ESTIMATE_ITEM_TYPES as readonly string[]).includes(row.itemType) ? row.itemType : "labor"
        ) as EstimateItemType;
        return {
          itemType,
          description: row.description,
          quantity: parseLineAmount(row.quantity) ?? 1,
          unitPrice: signedUnitPrice(itemType, parseLineAmount(row.unitPrice) ?? 0),
        };
      }),
    parseTaxRatePercent(taxRateInput) ?? 0,
  );

  const lineTotalFor = (row: Row): number => {
    const itemType = (
      (ESTIMATE_ITEM_TYPES as readonly string[]).includes(row.itemType) ? row.itemType : "labor"
    ) as EstimateItemType;
    const quantity = parseLineAmount(row.quantity) ?? 1;
    const unitPrice = signedUnitPrice(itemType, parseLineAmount(row.unitPrice) ?? 0);
    return Math.round(quantity * unitPrice * 100) / 100;
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="estimate_id" value={estimate.id} />

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.formError === "already_sent"
            ? e.alreadySentError
            : state.formError === "not_found"
              ? e.notFoundBody
              : e.genericError}
        </p>
      ) : null}
      {state.saved ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {e.savedNotice}
        </p>
      ) : null}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {e.headerSection}
        </legend>
        <div className="grid gap-4">
          <div>
            <label htmlFor="title" className={labelClass}>
              {e.titleField}
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={estimate.title}
              aria-invalid={state.errors.title ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            {errorFor("title") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("title")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="scope" className={labelClass}>
              {e.scopeField}
              <span className="ml-1.5 font-normal text-slate-500">({e.optional})</span>
            </label>
            <textarea
              id="scope"
              name="scope"
              rows={3}
              maxLength={5000}
              defaultValue={estimate.scope ?? ""}
              placeholder={e.scopePlaceholder}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {e.linesSection}
        </legend>

        {errorFor("items") ? (
          <p role="alert" className="mb-3 text-sm font-medium text-red-700">
            {errorFor("items")}
          </p>
        ) : null}

        {/* One block per line rather than a table: on a phone a four-column
            table of inputs is unusable, and this is a field tool (§13.9). */}
        <ul className="space-y-4">
          {rows.map((row, index) => {
            const lineTotal = lineTotalFor(row);
            return (
              <li key={row.key} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                  <div>
                    <label htmlFor={`item_type_${index}`} className="text-xs font-semibold text-slate-600">
                      {e.itemTypeField}
                    </label>
                    <select
                      id={`item_type_${index}`}
                      name="item_type"
                      value={row.itemType}
                      onChange={(event) => updateRow(row.key, { itemType: event.target.value })}
                      className={`mt-1 ${inputClass}`}
                    >
                      {ESTIMATE_ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {e.itemTypes[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`item_description_${index}`}
                      className="text-xs font-semibold text-slate-600"
                    >
                      {e.descriptionField}
                    </label>
                    <input
                      id={`item_description_${index}`}
                      name="item_description"
                      type="text"
                      maxLength={400}
                      value={row.description}
                      onChange={(event) => updateRow(row.key, { description: event.target.value })}
                      placeholder={e.descriptionPlaceholder}
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_10rem_1fr]">
                  <div>
                    <label
                      htmlFor={`item_quantity_${index}`}
                      className="text-xs font-semibold text-slate-600"
                    >
                      {e.quantityField}
                    </label>
                    <input
                      id={`item_quantity_${index}`}
                      name="item_quantity"
                      type="text"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`item_unit_price_${index}`}
                      className="text-xs font-semibold text-slate-600"
                    >
                      {row.itemType === "discount" ? e.discountAmountField : e.unitPriceField}
                    </label>
                    <input
                      id={`item_unit_price_${index}`}
                      name="item_unit_price"
                      type="text"
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })}
                      placeholder="0.00"
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-sm text-slate-600">
                      {e.lineTotal}:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatMoney(lineTotal, locale, currency)}
                      </span>
                    </p>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                        className="min-h-12 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-red-700"
                      >
                        {e.removeLine}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled={rows.length >= MAX_LINE_ITEMS}
          onClick={() => setRows((current) => [...current, blankRow(current.length)])}
          className="mt-4 min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
        >
          {e.addLine}
        </button>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {e.totalsSection}
        </legend>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-start">
          <div>
            <label htmlFor="tax_rate" className={labelClass}>
              {e.taxRateField}
            </label>
            <input
              id="tax_rate"
              name="tax_rate"
              type="text"
              inputMode="decimal"
              value={taxRateInput}
              onChange={(event) => setTaxRateInput(event.target.value)}
              placeholder="0"
              aria-describedby="tax_rate-hint"
              aria-invalid={state.errors.tax_rate ? true : undefined}
              className={`mt-1.5 ${inputClass}`}
            />
            <p id="tax_rate-hint" className="mt-1 text-xs text-slate-500">
              {e.taxRateHint}
            </p>
            {errorFor("tax_rate") ? (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {errorFor("tax_rate")}
              </p>
            ) : null}
          </div>
          <dl className="rounded-xl bg-slate-50 p-4">
            <div className="flex justify-between py-1">
              <dt className="text-slate-600">{e.subtotal}</dt>
              <dd className="font-medium text-slate-900">
                {formatMoney(preview.subtotal, locale, currency)}
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-slate-600">{e.tax}</dt>
              <dd className="font-medium text-slate-900">
                {formatMoney(preview.tax, locale, currency)}
              </dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-2">
              <dt className="font-bold text-slate-900">{e.total}</dt>
              <dd className="text-lg font-bold text-slate-900">
                {formatMoney(preview.total, locale, currency)}
              </dd>
            </div>
          </dl>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
        <legend className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          {e.termsSection}
        </legend>
        <label htmlFor="terms" className="sr-only">
          {e.termsField}
        </label>
        <textarea
          id="terms"
          name="terms"
          rows={4}
          maxLength={5000}
          defaultValue={estimate.terms ?? ""}
          placeholder={e.termsPlaceholder}
          className={inputClass}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? e.saving : e.save}
        </button>
        <Link
          href={`/${locale}/app/jobs/${jobId}`}
          className="min-h-12 font-semibold text-slate-600 hover:text-slate-900"
        >
          {e.cancel}
        </Link>
      </div>
      <p className="text-xs text-slate-500">{e.saveResetsApproval}</p>
    </form>
  );
}
