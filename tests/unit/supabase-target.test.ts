import { describe, expect, it } from "vitest";

import { resolveSupabaseAdminUrl, verifySupabaseProjectRef } from "@/lib/supabase/target";

const CANONICAL = "whwzfdkdxyycsvyvyxdn";
const BIZMETRIA = "rbndiytodvoyiejassnw";

describe("where elevated access points", () => {
  it("uses the hosted project when the app is configured for it", () => {
    expect(
      resolveSupabaseAdminUrl({
        SUPABASE_PROJECT_REF: CANONICAL,
        NEXT_PUBLIC_SUPABASE_URL: `https://${CANONICAL}.supabase.co`,
      }),
    ).toBe(`https://${CANONICAL}.supabase.co`);
  });

  /**
   * The bug this pins: the session client accepted a localhost stack while the
   * elevated client always returned the hosted project. Local development
   * therefore ran its service-role writes against production. CI only survived
   * because the local service key is not the hosted one — "Invalid API key" was
   * accidental protection, not a design.
   */
  it("uses the local stack when that is what the app is pointed at", () => {
    expect(
      resolveSupabaseAdminUrl({
        SUPABASE_PROJECT_REF: CANONICAL,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toBe("http://127.0.0.1:54321");

    expect(
      resolveSupabaseAdminUrl({
        SUPABASE_PROJECT_REF: CANONICAL,
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321/",
      }),
    ).toBe("http://localhost:54321");
  });

  // The local exception must not become a way around the ref check.
  it("still refuses a BizMetria ref, local stack or not", () => {
    expect(() =>
      resolveSupabaseAdminUrl({
        SUPABASE_PROJECT_REF: BIZMETRIA,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow();

    expect(() => verifySupabaseProjectRef({ SUPABASE_PROJECT_REF: BIZMETRIA })).toThrow();
  });

  it("refuses a ref that is not the canonical project", () => {
    expect(() =>
      resolveSupabaseAdminUrl({
        SUPABASE_PROJECT_REF: "someoneelsesproject",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow();
  });

  // A hosted URL keeps the hosted origin: the exception is narrow on purpose.
  it("does not treat a non-URL as local", () => {
    expect(
      resolveSupabaseAdminUrl({
        SUPABASE_PROJECT_REF: CANONICAL,
        NEXT_PUBLIC_SUPABASE_URL: "not a url",
      }),
    ).toBe(`https://${CANONICAL}.supabase.co`);
  });
});
