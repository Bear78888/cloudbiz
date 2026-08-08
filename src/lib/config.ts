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
  /**
   * Estimates are unlimited; *drafts written by the model* are not.
   *
   * The marketing promise is "unlimited estimates", and it stays true — an
   * owner can write as many as they like, by hand, forever. What has a ceiling
   * is calls to the model, because a $15/month tool with uncapped inference is
   * a hole in the unit economics that only shows up when the bill arrives.
   * Closing it before the first customer costs a sentence in the interface;
   * closing it afterwards costs a price change.
   *
   * 50 a day is far above what a one-person trade does — a busy pro quotes a
   * handful of jobs a day — and far below what a loop or a scraper does.
   */
  estimate_quote_maker: {
    aiDraftsPerDay: 50,
    /**
     * Voice notes (§16.3) go through a second, separate provider (speech-to-
     * text, not the drafting model), so they get their own daily ceiling
     * rather than sharing the drafts one — a busy day of dictating job
     * descriptions is not the same cost as a busy day of drafting, and a
     * single number would either starve one or leave the other uncapped.
     * 30 a day covers dictating more job descriptions than a one-person shop
     * writes in a day, same reasoning as `aiDraftsPerDay` above.
     */
    voiceTranscriptionsPerDay: 30,
  },
  reviews_followups: { includedSms: 200 },
  bad_lead_refund_helper: { includedAnalyses: 10 },
  /**
   * One site per organization, and a ceiling on machine translation.
   *
   * The site itself is unlimited to edit; what has a cap is calls to the model
   * (§19.5), for the same reason the estimate drafts do — a $12/month tool with
   * uncapped inference is a tool whose economics arrive with the bill. Ten a
   * day is far more than translating one page needs and low enough to notice a
   * loop.
   */
  business_website: { sitesPerOrganization: 1, aiTranslationsPerDay: 10 },
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

/**
 * Google OAuth sign-in flag (§10.1, audit §4.3: behind a flag until the
 * owner's Google Cloud project + verified consent screen exist, §00.3).
 */
export const GOOGLE_AUTH_ENABLED = false;
