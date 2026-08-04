/**
 * Product & pricing configuration (spec §5, §6).
 * Prices are initial hypotheses; they must be editable here (and later via
 * Stripe / admin settings) without touching components (§6.2.1).
 */

export type ProductCode =
  | "call_answering"
  | "estimate_quote_maker"
  | "reviews_followups"
  | "bad_lead_refund_helper"
  | "business_website"
  | "job_tracker";

/** The five paid tools (spec §5) — everything except the free Job Tracker. */
export type PaidProductCode = Exclude<ProductCode, "job_tracker">;

export type TradeCode =
  | "handyman"
  | "plumbing"
  | "hvac"
  | "electrical"
  | "cleaning"
  | "appliance_repair";

export interface ProductConfig {
  code: PaidProductCode;
  /** URL slug per locale (spec §7.1) */
  slugs: { en: string; es: string };
  paid: boolean;
}

export const PRODUCTS: ProductConfig[] = [
  {
    code: "call_answering",
    slugs: { en: "call-answering", es: "respuesta-de-llamadas" },
    paid: true,
  },
  {
    code: "estimate_quote_maker",
    slugs: { en: "estimate-maker", es: "creador-de-presupuestos" },
    paid: true,
  },
  {
    code: "reviews_followups",
    slugs: { en: "reviews-follow-ups", es: "resenas-y-seguimiento" },
    paid: true,
  },
  {
    code: "bad_lead_refund_helper",
    slugs: { en: "bad-lead-refund-helper", es: "reembolso-de-leads" },
    paid: true,
  },
  {
    code: "business_website",
    slugs: { en: "business-website", es: "sitio-web" },
    paid: true,
  },
];

/** Initial pricing hypotheses in USD (spec §6, §6.1a). Configuration, not UI hardcode. */
export const PRICING = {
  call_answering: { monthly: 89, from: true },
  estimate_quote_maker: { monthly: 15 },
  reviews_followups: { monthly: 15 },
  bad_lead_refund_helper: { monthly: 29, oneTime: 9 },
  business_website: { monthly: 12, yearly: 99 },
  all_tools_bundle: { monthly: 109, savePercent: 30 },
} as const;

/** Default usage limits (spec §6.1a) — shown before purchase (§6.2.10). */
export const LIMITS = {
  call_answering: { includedMinutes: 100, overagePerMinute: 0.35 },
  reviews_followups: { includedSms: 200 },
  bad_lead_refund_helper: { includedAnalyses: 10 },
  business_website: { sitesPerOrganization: 1 },
} as const;

export interface TradeConfig {
  code: TradeCode;
  slugs: { en: string; es: string };
}

export const TRADES: TradeConfig[] = [
  { code: "handyman", slugs: { en: "handyman", es: "handyman" } },
  { code: "plumbing", slugs: { en: "plumbing", es: "plomeria" } },
  { code: "hvac", slugs: { en: "hvac", es: "hvac" } },
  { code: "electrical", slugs: { en: "electrical", es: "electricistas" } },
  { code: "cleaning", slugs: { en: "cleaning", es: "limpieza" } },
  {
    code: "appliance_repair",
    slugs: { en: "appliance-repair", es: "reparacion-de-electrodomesticos" },
  },
];

/**
 * Spanish content publication flag (spec §9.6): i18n infrastructure is fully
 * built from Stage 1; this flag controls whether /es is announced in
 * sitemap/robots once the owner approves the Spanish copy. The routes stay
 * reachable for review either way.
 */
export const SPANISH_CONTENT_PUBLISHED = true;
