import { afterEach, describe, expect, it } from "vitest";

import { resolveAppUrl } from "@/lib/app-url";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("resolving the deployment's own address", () => {
  it("prefers the configured URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://handyalliance.com/";
    process.env.VERCEL_URL = "something-else.vercel.app";
    expect(resolveAppUrl()).toBe("https://handyalliance.com");
  });

  // Preview deployments deliberately have no NEXT_PUBLIC_APP_URL, so their
  // links must point at the preview that produced them, not at production.
  it("falls back to the deployment host", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_URL = "preview-abc123.vercel.app";
    expect(resolveAppUrl()).toBe("https://preview-abc123.vercel.app");
  });

  it("uses the request origin before giving up", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(resolveAppUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  // No hardcoded domain at the end of the chain: inventing a plausible URL is
  // how a dead link ended up in a customer's spreadsheet.
  it("returns null rather than guessing", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(resolveAppUrl()).toBeNull();
  });
});
