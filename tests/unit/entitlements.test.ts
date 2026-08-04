import { describe, expect, it } from "vitest";

import {
  defaultLimitsForFeature,
  featuresForProduct,
  hasActiveFeature,
  resolveEntitlements,
} from "@/features/entitlements/logic";

describe("featuresForProduct", () => {
  it("maps an individual tool to itself", () => {
    expect(featuresForProduct("estimate_quote_maker")).toEqual(["estimate_quote_maker"]);
  });

  it("maps the bundle to all five paid tools (§6.1)", () => {
    const features = featuresForProduct("all_tools_bundle");
    expect(features).toContain("call_answering");
    expect(features).toContain("estimate_quote_maker");
    expect(features).toContain("reviews_followups");
    expect(features).toContain("bad_lead_refund_helper");
    expect(features).toContain("business_website");
  });
});

describe("resolveEntitlements", () => {
  it("always includes free job_tracker even with no subscriptions (§13.1)", () => {
    const result = resolveEntitlements([]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ featureCode: "job_tracker", status: "active" });
  });

  it("grants a feature for active/trialing/past_due and suspends for unpaid/canceled", () => {
    for (const status of ["active", "trialing", "past_due"] as const) {
      const result = resolveEntitlements([
        { productCode: "reviews_followups", status, currentPeriodEnd: null },
      ]);
      expect(hasActiveFeature(result, "reviews_followups")).toBe(true);
    }
    for (const status of ["unpaid", "canceled", "incomplete", "paused"] as const) {
      const result = resolveEntitlements([
        { productCode: "reviews_followups", status, currentPeriodEnd: null },
      ]);
      expect(hasActiveFeature(result, "reviews_followups")).toBe(false);
    }
  });

  it("applies default limits from configuration (§6.1a)", () => {
    const result = resolveEntitlements([
      { productCode: "call_answering", status: "active", currentPeriodEnd: null },
    ]);
    const call = result.find((e) => e.featureCode === "call_answering");
    expect(call?.limits).toEqual({ included_minutes: 100, overage_cents_per_minute: 35 });
    expect(defaultLimitsForFeature("reviews_followups")).toEqual({ included_sms: 200 });
  });

  it("does not let a canceled individual tool revoke a feature the bundle still grants", () => {
    const result = resolveEntitlements([
      { productCode: "all_tools_bundle", status: "active", currentPeriodEnd: "2027-01-01T00:00:00Z" },
      { productCode: "estimate_quote_maker", status: "canceled", currentPeriodEnd: null },
    ]);
    expect(hasActiveFeature(result, "estimate_quote_maker")).toBe(true);
  });

  it("keeps the later expiry when two subscriptions grant the same feature", () => {
    const result = resolveEntitlements([
      { productCode: "business_website", status: "active", currentPeriodEnd: "2026-09-01T00:00:00Z" },
      { productCode: "all_tools_bundle", status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z" },
    ]);
    const site = result.find((e) => e.featureCode === "business_website");
    expect(site?.validUntil).toBe("2026-12-01T00:00:00Z");
  });

  it("a canceled subscription alone yields a suspended entitlement (refund path §6.2.9)", () => {
    const result = resolveEntitlements([
      { productCode: "business_website", status: "canceled", currentPeriodEnd: null },
    ]);
    const site = result.find((e) => e.featureCode === "business_website");
    expect(site?.status).toBe("suspended");
  });
});
