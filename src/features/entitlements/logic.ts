import { LIMITS } from "@/lib/config";
import type { BillableProductCode, FeatureCode } from "@/features/billing/catalog";

/**
 * Pure entitlement resolution (§6.2.3, §25.9): given the local subscription
 * cache (fed exclusively by Stripe webhooks, §6.2.4), compute which features
 * an organization is entitled to and with what limits. No I/O here — the
 * store layer persists whatever this returns.
 */

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionSnapshot {
  productCode: BillableProductCode;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

export interface ResolvedEntitlement {
  featureCode: FeatureCode;
  status: "active" | "suspended";
  limits: Record<string, number>;
  validUntil: string | null;
}

/**
 * Statuses that keep a tool usable. past_due keeps access during the dunning
 * window (Stripe retries the charge); unpaid/canceled/incomplete revoke it.
 */
const GRANTING_STATUSES: readonly SubscriptionStatus[] = ["active", "trialing", "past_due"];

/** Features granted by each purchasable product (bundle → all five tools, §6.1). */
export function featuresForProduct(productCode: BillableProductCode): FeatureCode[] {
  if (productCode === "all_tools_bundle") {
    return [
      "all_tools_bundle",
      "call_answering",
      "estimate_quote_maker",
      "reviews_followups",
      "bad_lead_refund_helper",
      "business_website",
    ];
  }
  return [productCode];
}

/** Default limits per feature (§6.1a) — stored on the entitlement row so the
 * admin can override per organization later (§11.5). */
export function defaultLimitsForFeature(featureCode: FeatureCode): Record<string, number> {
  switch (featureCode) {
    case "call_answering":
      return {
        included_minutes: LIMITS.call_answering.includedMinutes,
        overage_cents_per_minute: Math.round(LIMITS.call_answering.overagePerMinute * 100),
      };
    case "reviews_followups":
      return { included_sms: LIMITS.reviews_followups.includedSms };
    case "bad_lead_refund_helper":
      return { included_analyses: LIMITS.bad_lead_refund_helper.includedAnalyses };
    case "business_website":
      return { sites_per_organization: LIMITS.business_website.sitesPerOrganization };
    default:
      return {};
  }
}

/**
 * Resolve the full entitlement set from the subscription cache. Job Tracker
 * is always present and free (§13.1) — it never depends on billing state.
 * When several subscriptions grant the same feature (e.g. individual tool +
 * bundle during an upgrade window), the feature stays active as long as at
 * least one granting subscription covers it — no double revocation.
 */
export function resolveEntitlements(
  subscriptions: readonly SubscriptionSnapshot[],
): ResolvedEntitlement[] {
  const byFeature = new Map<FeatureCode, ResolvedEntitlement>();

  byFeature.set("job_tracker", {
    featureCode: "job_tracker",
    status: "active",
    limits: {},
    validUntil: null,
  });

  for (const subscription of subscriptions) {
    const granting = GRANTING_STATUSES.includes(subscription.status);
    for (const featureCode of featuresForProduct(subscription.productCode)) {
      const existing = byFeature.get(featureCode);
      if (existing?.status === "active" && !granting) continue;
      if (existing?.status === "active" && granting) {
        // Keep the later expiry when two subscriptions grant the same feature.
        const later =
          existing.validUntil !== null &&
          subscription.currentPeriodEnd !== null &&
          subscription.currentPeriodEnd > existing.validUntil
            ? subscription.currentPeriodEnd
            : existing.validUntil;
        byFeature.set(featureCode, { ...existing, validUntil: later });
        continue;
      }
      byFeature.set(featureCode, {
        featureCode,
        status: granting ? "active" : "suspended",
        limits: granting ? defaultLimitsForFeature(featureCode) : {},
        validUntil: subscription.currentPeriodEnd,
      });
    }
  }

  return [...byFeature.values()];
}

export function hasActiveFeature(
  entitlements: readonly Pick<ResolvedEntitlement, "featureCode" | "status">[],
  featureCode: FeatureCode,
): boolean {
  return entitlements.some((e) => e.featureCode === featureCode && e.status === "active");
}
