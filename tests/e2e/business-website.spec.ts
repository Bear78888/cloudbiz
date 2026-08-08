import { expect, test } from "@playwright/test";

import { banner, createOrganization, formWith, signUp, submitAndSettle, uniqueEmail } from "./helpers";

/**
 * Business Website settings end to end (§19.3–19.5).
 *
 * Two things here are worth checking against a running application rather than
 * in a unit test, because each is enforced by the database and by the page at
 * once: that the address belongs to one business across the whole platform, and
 * that a private draft is exactly that — content saved on this screen reaches no
 * public URL (§19.10).
 *
 * Everything goes through the real forms, the real server actions and real RLS.
 */

const SETTINGS_PATH = "/en/app/settings/website";

test("an owner sets up a site, and the address is theirs alone", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("website"));
  await createOrganization(page, `Website Test ${stamp}`);

  // The tool is reachable from the shell, not only by typing a URL.
  await page.getByRole("link", { name: "Website", exact: true }).click();
  await page.waitForURL(/\/app\/settings\/website/, { timeout: 30_000 });

  // A brand-new organization gets an address suggested from its name, and a
  // list of what is still missing before anyone should see the page (§19.10).
  const slug = `website-test-${stamp}`;
  await expect(page.locator("#slug")).toHaveValue(slug);
  await expect(page.getByText(/Add a phone number/i)).toBeVisible();
  await expect(page.getByText(/Write a headline/i)).toBeVisible();

  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));
  await expect(banner(page, "status", /^Saved/i)).toBeVisible();

  // The content form is a separate submission, so saving text does not touch
  // the address and changing the address does not rewrite the text.
  await page.goto(SETTINGS_PATH);
  await page.locator("#headline").fill("Licensed plumbing, same-day service");
  await page.locator("#why_choose_us").fill("Licensed and insured\nUpfront pricing");
  await page.locator("#faq_question_0").fill("Do you charge for quotes?");
  await page.locator("#faq_answer_0").fill("No, quotes are free.");
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );
  await expect(banner(page, "status", /^Saved/i)).toBeVisible();

  // Saved content comes back, and the headline blocker is gone with it.
  await page.goto(SETTINGS_PATH);
  await expect(page.locator("#headline")).toHaveValue("Licensed plumbing, same-day service");
  await expect(page.locator("#why_choose_us")).toHaveValue("Licensed and insured\nUpfront pricing");
  await expect(page.locator("#faq_question_0")).toHaveValue("Do you charge for quotes?");
  await expect(page.locator("#slug")).toHaveValue(slug);
  await expect(page.getByText(/Write a headline/i)).toHaveCount(0);

  // §19.10: nothing saved here is public. The address is settled and resolves
  // nowhere — the public renderer arrives with publishing.
  const draft = await page.request.get(`/pro/${slug}/en`, { maxRedirects: 0 });
  expect(draft.status()).toBe(404);

  // A second business cannot take the same address. The unique index is what
  // makes that true; this asserts the owner is told so in a sentence rather
  // than shown a constraint name (§29).
  await submitAndSettle(page, page.getByRole("button", { name: /^Sign out$/ }));
  await signUp(page, uniqueEmail("website-rival"));
  await createOrganization(page, `Rival Plumbing ${stamp}`);
  await page.goto(SETTINGS_PATH);
  await page.locator("#slug").fill(slug);
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));
  await expect(page.getByText(/already uses that address/i)).toBeVisible();
});

test("the section list follows what the business actually has", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("website-blocks"));
  await createOrganization(page, `Blocks Test ${stamp}`);
  await page.goto(SETTINGS_PATH);

  const sections = page
    .getByRole("list", { name: /Sections on your page right now/i })
    .getByRole("listitem");

  // Reviews and the service area are absent because there is nothing to put in
  // them — §19.8 forbids inventing either, so an empty block is not an option.
  await expect(sections.filter({ hasText: /^Headline$/ })).toHaveCount(1);
  await expect(sections.filter({ hasText: /^Reviews$/ })).toHaveCount(0);
  await expect(sections.filter({ hasText: /^Service area$/ })).toHaveCount(0);
  await expect(sections.filter({ hasText: /^Photos$/ })).toHaveCount(0);

  // Switching a block off is remembered, and the page stops carrying it.
  await page.getByRole("checkbox", { name: "Contact form", exact: true }).uncheck();
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));

  await page.goto(SETTINGS_PATH);
  await expect(page.getByRole("checkbox", { name: "Contact form", exact: true })).not.toBeChecked();
  await expect(sections.filter({ hasText: /^Contact form$/ })).toHaveCount(0);
});
