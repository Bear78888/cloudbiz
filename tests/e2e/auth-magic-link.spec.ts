import { expect, test } from "@playwright/test";

import { banner, uniqueEmail } from "./helpers";

/**
 * "Email me a sign-in link" (§10.1) — the one Supabase-native auth email that
 * actually fires against the real local stack in this suite (`enable_confirmations`
 * is off locally, so signUp() never sends one; see supabase/config.toml).
 *
 * This cannot see the email itself — Mailpit is excluded from the CI stack to
 * keep it fast (`supabase start -x ... mailpit`), and reversing that for one
 * template would cost every ordinary PR the runtime it was removed to save.
 * What this checks is the thing the code change in this PR could plausibly
 * have broken: passing `data: { preferred_locale }` to signInWithOtp() is a
 * new argument to a real API call, and a malformed one fails at the request,
 * which is the one failure mode visible from here.
 */

test("requesting a sign-in link succeeds with the locale attached", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.locator("#signin-email").fill(uniqueEmail("magic-link"));
  await page.getByRole("button", { name: /Email me a sign-in link/i }).click();

  await expect(banner(page, "status", /sent you a sign-in link/i)).toBeVisible();
});

test("the same request from the Spanish sign-in page also succeeds", async ({ page }) => {
  await page.goto("/es/iniciar-sesion");
  await page.locator("#signin-email").fill(uniqueEmail("magic-link-es"));
  await page.getByRole("button", { name: /Envíenme un enlace/i }).click();

  await expect(banner(page, "status", /enviamos un enlace/i)).toBeVisible();
});
