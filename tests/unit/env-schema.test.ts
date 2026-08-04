import { describe, expect, it } from "vitest";

import { validateEnvironment } from "@/lib/env/schema";
import { CANONICAL_SUPABASE_PROJECT_REF } from "@/lib/supabase/target";

const canonicalRef = CANONICAL_SUPABASE_PROJECT_REF ?? "abcdefghijkl";

const validBrowser = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${canonicalRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
};

const validPlatform = {
  ...validBrowser,
  SUPABASE_PROJECT_REF: canonicalRef,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("validateEnvironment", () => {
  it("accepts a valid browser scope", () => {
    expect(validateEnvironment(validBrowser, "browser").ok).toBe(true);
  });

  it("reports missing names without values", () => {
    const check = validateEnvironment({}, "platform");
    expect(check.ok).toBe(false);
    expect(check.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(check.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects a foreign project ref — including BizMetria's", () => {
    for (const foreignRef of ["rbndiytodvoyiejassnw", "someone-elses-project"]) {
      const check = validateEnvironment(
        { ...validPlatform, SUPABASE_PROJECT_REF: foreignRef },
        "platform",
      );
      expect(check.ok).toBe(false);
      expect(check.invalid).toContain("SUPABASE_PROJECT_REF");
    }
  });

  it("rejects a Supabase URL with a path", () => {
    const check = validateEnvironment(
      { ...validBrowser, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijkl.supabase.co/rest/v1" },
      "browser",
    );
    expect(check.ok).toBe(false);
    expect(check.invalid).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("pins Stripe keys to test mode unless STRIPE_LIVE_MODE=live", () => {
    const base = {
      ...validPlatform,
      STRIPE_SECRET_KEY: "sk_live_123",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_123",
    };
    const testModeCheck = validateEnvironment(base, "integrations");
    expect(testModeCheck.ok).toBe(false);
    expect(testModeCheck.invalid).toContain("STRIPE_SECRET_KEY");
    expect(testModeCheck.invalid).toContain("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

    const liveModeCheck = validateEnvironment({ ...base, STRIPE_LIVE_MODE: "live" }, "integrations");
    expect(liveModeCheck.ok).toBe(true);
  });

  it("rejects a webhook secret without the whsec_ prefix", () => {
    const check = validateEnvironment(
      {
        ...validPlatform,
        STRIPE_SECRET_KEY: "sk_test_123",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
        STRIPE_WEBHOOK_SECRET: "not-a-secret",
      },
      "integrations",
    );
    expect(check.ok).toBe(false);
    expect(check.invalid).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("accepts a fully configured integrations scope with synthetic literals", () => {
    const check = validateEnvironment(
      {
        ...validPlatform,
        STRIPE_SECRET_KEY: "sk_test_123",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_123",
      },
      "integrations",
    );
    expect(check.ok).toBe(true);
  });
});
