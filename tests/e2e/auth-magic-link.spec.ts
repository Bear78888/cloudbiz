import { expect, test } from "@playwright/test";

import { banner, uniqueEmail } from "./helpers";

/**
 * "Email me a sign-in link" (§10.1) — the one Supabase-native auth email that
 * actually fires against the real local stack in this suite (`enable_confirmations`
 * is off locally, so signUp() never sends one; see supabase/config.toml).
 *
 * This cannot see the email itself — reading the rendered content would mean
 * driving Mailpit's own UI, which this test has no need for. What it checks
 * is the thing the code change in this PR could plausibly have broken:
 * passing `data: { preferred_locale }` to signInWithOtp() is a new argument
 * to a real API call, and a malformed one fails at the request, which is the
 * one failure mode visible from here.
 *
 * Mailpit itself, however, is not optional infrastructure this test can do
 * without: GoTrue's SMTP host in this stack is wired to it whenever
 * `[local_smtp]` is enabled in config.toml (true here), regardless of
 * whether anything ever reads the resulting mail. This test was originally
 * written assuming CI's exclusion of Mailpit (`supabase start -x ...
 * mailpit`, kept for runtime — see the CI workflow) only cost it the ability
 * to inspect content, and that assumption was wrong: without Mailpit
 * running, every real send fails outright with a DNS lookup error, and this
 * test failed on that for real, four CI runs in a row, each time diagnosed
 * (incorrectly) as a template bug before the actual cause surfaced — see
 * docs/HANDYALLIANCE_ARCHITECTURE.md §5i. Mailpit is back in the CI stack
 * because of this test specifically.
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
