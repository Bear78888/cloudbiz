import "server-only";

/**
 * Product analytics (§31.1).
 *
 * No provider is connected yet — GA4 / Search Console access is still
 * outstanding (§00.0.5) — so this is the seam, not the integration: call sites
 * emit typed events today, and wiring a provider later touches only `emit`.
 * Events carry ids and codes, never customer names, phones or emails (§26.6).
 */

export const ANALYTICS_EVENTS = [
  "landing_viewed",
  "tool_viewed",
  "pricing_viewed",
  "signup_started",
  "signup_completed",
  "business_profile_completed",
  "job_created",
  "job_status_changed",
  "job_deleted",
  "jobs_imported",
  "estimate_created",
  "estimate_status_changed",
  "estimate_sent",
  "estimate_ai_drafted",
  "estimate_voice_transcribed",
  "website_settings_saved",
  "website_content_saved",
  "website_published",
  "website_unpublished",
  "website_rolled_back",
  "website_translated",
  "website_lead_received",
  "google_connect_started",
  "google_connected",
  "google_sync_failed",
  "checkout_started",
  "subscription_activated",
  "subscription_canceled",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** Only ids, codes and counts — nothing that identifies an end customer. */
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export function trackServerEvent(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
): void {
  if (process.env.NODE_ENV === "development") {
    console.info(`[analytics] ${event}`, properties);
  }
  // Provider dispatch lands here once GA4 (or its replacement) is available.
}
