import { PRICING } from "@/lib/config";
import type { ProductCode } from "@/lib/config";

/**
 * Billing catalog (§5.1, §6). Stripe Prices are looked up by lookup_key and
 * re-verified against the expected amount before Checkout (audit §4.2:
 * amount mismatch is a non-retryable configuration error, never a silent
 * fallback). Price IDs are NOT hardcoded (§6.2.2) — the lookup keys below are
 * the stable configuration, provisioned in Stripe by an idempotent script in
 * a later step (owner's Stripe access pending, §00.0.5).
 */

/** Everything purchasable: five paid tools plus the bundle (§5, §6.1). */
export type BillableProductCode = Exclude<ProductCode, "job_tracker"> | "all_tools_bundle";

/** Feature codes that entitlements are stored under (§25.9). */
export type FeatureCode = ProductCode | "all_tools_bundle";

export type BillingInterval = "month" | "year";

export interface CatalogEntry {
  productCode: BillableProductCode;
  interval: BillingInterval;
  lookupKey: string;
  /** Expected amount in USD cents; re-verified against Stripe before Checkout. */
  expectedUnitAmount: number;
  currency: "usd";
}

const toCents = (dollars: number): number => Math.round(dollars * 100);

export const BILLING_CATALOG: readonly CatalogEntry[] = [
  {
    productCode: "call_answering",
    interval: "month",
    lookupKey: "handyalliance_call_answering_monthly",
    expectedUnitAmount: toCents(PRICING.call_answering.monthly),
    currency: "usd",
  },
  {
    productCode: "estimate_quote_maker",
    interval: "month",
    lookupKey: "handyalliance_estimate_quote_maker_monthly",
    expectedUnitAmount: toCents(PRICING.estimate_quote_maker.monthly),
    currency: "usd",
  },
  {
    productCode: "reviews_followups",
    interval: "month",
    lookupKey: "handyalliance_reviews_followups_monthly",
    expectedUnitAmount: toCents(PRICING.reviews_followups.monthly),
    currency: "usd",
  },
  {
    productCode: "bad_lead_refund_helper",
    interval: "month",
    lookupKey: "handyalliance_bad_lead_refund_helper_monthly",
    expectedUnitAmount: toCents(PRICING.bad_lead_refund_helper.monthly),
    currency: "usd",
  },
  {
    productCode: "business_website",
    interval: "month",
    lookupKey: "handyalliance_business_website_monthly",
    expectedUnitAmount: toCents(PRICING.business_website.monthly),
    currency: "usd",
  },
  {
    productCode: "business_website",
    interval: "year",
    lookupKey: "handyalliance_business_website_yearly",
    expectedUnitAmount: toCents(PRICING.business_website.yearly),
    currency: "usd",
  },
  {
    productCode: "all_tools_bundle",
    interval: "month",
    lookupKey: "handyalliance_all_tools_monthly",
    expectedUnitAmount: toCents(PRICING.all_tools_bundle.monthly),
    currency: "usd",
  },
] as const;

export function findCatalogEntry(
  productCode: BillableProductCode,
  interval: BillingInterval,
): CatalogEntry | undefined {
  return BILLING_CATALOG.find((e) => e.productCode === productCode && e.interval === interval);
}

export function isBillableProductCode(value: string): value is BillableProductCode {
  return BILLING_CATALOG.some((e) => e.productCode === value);
}
