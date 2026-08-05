/**
 * Estimate form parsing (§16.4) — pure, so the same rules serve the editor, the
 * server action and, later, the AI draft that has to be checked before it is
 * shown as a price.
 *
 * Errors are codes, never sentences: the caller looks them up in the dictionary
 * of the current locale (§9.2).
 */

import {
  ESTIMATE_ITEM_TYPES,
  MAX_TAX_RATE,
  signedUnitPrice,
  type EstimateItemType,
  type LineItemInput,
} from "./model";

export type EstimateFieldErrorCode =
  | "required"
  | "too_long"
  | "invalid_amount"
  | "invalid_choice"
  | "invalid_rate"
  | "too_many_items";

export type EstimateFormField = "title" | "scope" | "terms" | "tax_rate" | "items";

export type EstimateFormErrors = Partial<Record<EstimateFormField, EstimateFieldErrorCode>>;

export interface EstimateFormInput {
  title: string;
  scope: string | null;
  terms: string | null;
  taxRate: number;
  items: LineItemInput[];
}

export type EstimateFormResult =
  | { ok: true; value: EstimateFormInput }
  | { ok: false; errors: EstimateFormErrors };

/** One screenful of work is generous; a thousand lines is a runaway loop. */
export const MAX_LINE_ITEMS = 60;

const MAX_SHORT = 200;
const MAX_LONG = 5000;

/**
 * Money as typed into an estimate line.
 *
 * Unlike {@link parseMoney} in the job model this accepts a leading minus,
 * because a discount is a real negative line (§16.4). The sign is then decided
 * by the item type, not by whether the user remembered to type it — see
 * `signedUnitPrice`.
 */
export function parseLineAmount(raw: string | null | undefined): number | null | undefined {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  let cleaned = trimmed.replace(/[$\s ]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }

  if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === "-") return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return undefined;
  return Math.round(value * 100) / 100;
}

/**
 * A tax rate typed as a percentage — `8.25`, `8,25`, `8.25%` — as a fraction.
 *
 * Returns undefined for anything that is not a number or is outside the range,
 * so `825` typed by someone who meant `8.25` is refused rather than applied.
 */
export function parseTaxRatePercent(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return 0;
  const trimmed = String(raw).trim().replace(/%$/, "").replace(",", ".");
  if (trimmed === "") return 0;
  if (!/^\d*\.?\d*$/.test(trimmed)) return undefined;

  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0) return undefined;

  // Four decimal places, matching the column: 8.25% is 0.0825 exactly.
  const rate = Math.round((percent / 100) * 10000) / 10000;
  if (rate > MAX_TAX_RATE) return undefined;
  return rate;
}

export interface RawLineItem {
  item_type?: string;
  description?: string;
  quantity?: string;
  unit_price?: string;
}

export interface RawEstimateForm {
  title?: string;
  scope?: string;
  terms?: string;
  tax_rate?: string;
  items?: RawLineItem[];
}

function text(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function optionalText(raw: string | undefined): string | null {
  const value = text(raw);
  return value === "" ? null : value;
}

function isItemType(value: string): value is EstimateItemType {
  return (ESTIMATE_ITEM_TYPES as readonly string[]).includes(value);
}

/**
 * Validates an estimate submission.
 *
 * Blank rows are dropped rather than rejected: the editor always renders a
 * spare row for the next line, and making the user clear it before saving would
 * be a rule invented by the form rather than by the work.
 */
export function parseEstimateForm(raw: RawEstimateForm): EstimateFormResult {
  const errors: EstimateFormErrors = {};

  const title = text(raw.title);
  if (title === "") errors.title = "required";
  else if (title.length > MAX_SHORT) errors.title = "too_long";

  const scope = optionalText(raw.scope);
  if (scope && scope.length > MAX_LONG) errors.scope = "too_long";

  const terms = optionalText(raw.terms);
  if (terms && terms.length > MAX_LONG) errors.terms = "too_long";

  const taxRate = parseTaxRatePercent(raw.tax_rate);
  if (taxRate === undefined) errors.tax_rate = "invalid_rate";

  const rows = raw.items ?? [];
  // A row counts as started when it has a description or a price. Quantity is
  // deliberately not evidence: the editor pre-fills its spare rows with `1`,
  // and treating that as "the user began this line" would make every save fail
  // on a row nobody touched.
  const filled = rows.filter(
    (row) => text(row.description) !== "" || text(row.unit_price) !== "",
  );

  if (filled.length > MAX_LINE_ITEMS) errors.items = "too_many_items";

  const items: LineItemInput[] = [];
  for (const row of filled) {
    const description = text(row.description);
    if (description === "") {
      errors.items ??= "required";
      continue;
    }
    if (description.length > MAX_SHORT * 2) {
      errors.items ??= "too_long";
      continue;
    }

    const itemTypeRaw = text(row.item_type) || "labor";
    if (!isItemType(itemTypeRaw)) {
      errors.items ??= "invalid_choice";
      continue;
    }

    // An omitted quantity means one of the thing, which is what the field is
    // blank for on nine lines out of ten.
    const quantity = parseLineAmount(row.quantity);
    const unitPrice = parseLineAmount(row.unit_price);
    if (quantity === undefined || unitPrice === undefined) {
      errors.items ??= "invalid_amount";
      continue;
    }
    if (quantity !== null && quantity < 0) {
      errors.items ??= "invalid_amount";
      continue;
    }

    items.push({
      itemType: itemTypeRaw,
      description,
      quantity: quantity ?? 1,
      unitPrice: signedUnitPrice(itemTypeRaw, unitPrice ?? 0),
    });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, value: { title, scope, terms, taxRate: taxRate ?? 0, items } };
}
