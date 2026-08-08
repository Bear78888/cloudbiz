import { expect, test } from "@playwright/test";

import { banner, createOrganization, formWith, signUp, submitAndSettle, uniqueEmail } from "./helpers";

/**
 * The business profile end to end (§10.2 steps 3–5).
 *
 * The assertion that matters is the last one: filling this screen in changes
 * what the website screen says. Those two pages are the only reader and the
 * only writer of `business_profiles`, and until this screen existed the
 * website's readiness list asked for a phone number with nowhere to type one.
 * A unit test cannot show that the loop is closed; this can.
 */

const PROFILE_PATH = "/en/app/settings/business";
const WEBSITE_PATH = "/en/app/settings/website";

test("filling in the business profile satisfies the website's readiness list", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("profile"));
  // `createOrganization` picks the plumbing trade, so the presets below are its.
  await createOrganization(page, `Profile Test ${stamp}`);

  await page.getByRole("link", { name: "Business", exact: true }).click();
  await page.waitForURL(/\/app\/settings\/business/, { timeout: 30_000 });

  // A new organization has nothing but its name: every one of these columns has
  // existed since the platform foundation with no writer at all.
  const gaps = page.getByRole("list", { name: /Still blank/i }).getByRole("listitem");
  await expect(gaps.filter({ hasText: /Phone number/i })).toHaveCount(1);
  await expect(gaps.filter({ hasText: /services you offer/i })).toHaveCount(1);
  await expect(gaps.filter({ hasText: /Where you work/i })).toHaveCount(1);

  await page.locator("#phone").fill("(512) 555-0134");
  await page.locator("#email").fill(`shop-${stamp}@handyalliance.test`);
  await page.locator("#zip_codes").fill("78701, 78702\n78701");
  await page.locator("#cities").fill("Austin");

  // §10.2 step 4: a suggestion for the trade, which writes nothing until it is
  // pressed and can be reworded afterwards.
  await page.getByRole("button", { name: "+ Drain cleaning" }).click();
  await expect(page.locator("#service_name_en_0")).toHaveValue("Drain cleaning");
  // A preset already taken stops being offered.
  await expect(page.getByRole("button", { name: "+ Drain cleaning" })).toHaveCount(0);
  await page.locator("#service_name_en_0").fill("Drain cleaning and jetting");

  await page.getByRole("checkbox", { name: "Monday", exact: true }).check();
  await page.locator("#open_mon").fill("08:00");
  await page.locator("#close_mon").fill("17:00");

  await submitAndSettle(
    page,
    formWith(page, "#phone").getByRole("button", { name: /Save business details/i }),
  );
  await expect(banner(page, "status", /^Saved/i)).toBeVisible();

  // Everything comes back, including the de-duplicated ZIP list and the edit
  // made to the preset's wording.
  await page.goto(PROFILE_PATH);
  await expect(page.locator("#phone")).toHaveValue("(512) 555-0134");
  await expect(page.locator("#zip_codes")).toHaveValue("78701\n78702");
  await expect(page.locator("#cities")).toHaveValue("Austin");
  await expect(page.locator("#service_name_en_0")).toHaveValue("Drain cleaning and jetting");
  await expect(page.getByRole("checkbox", { name: "Monday", exact: true })).toBeChecked();
  await expect(page.locator("#open_mon")).toHaveValue("08:00");

  // The loop: the website screen reads these fields, so its blockers clear and
  // the sections that had nothing to show now have something.
  await page.goto(WEBSITE_PATH);
  await expect(page.getByText(/Add a phone number/i)).toHaveCount(0);
  await expect(page.getByText(/Add the services you offer/i)).toHaveCount(0);

  const sections = page
    .getByRole("list", { name: /Sections on your page right now/i })
    .getByRole("listitem");
  await expect(sections.filter({ hasText: /^Services$/ })).toHaveCount(1);
  await expect(sections.filter({ hasText: /^Service area$/ })).toHaveCount(1);
  await expect(sections.filter({ hasText: /^Call button$/ })).toHaveCount(1);
  // Still no reviews: no review link was given, and §19.8 forbids inventing one.
  await expect(sections.filter({ hasText: /^Reviews$/ })).toHaveCount(0);
});

test("the profile refuses values that could not do their job", async ({ page }) => {
  await signUp(page, uniqueEmail("profile-validation"));
  await createOrganization(page, `Validation Test ${Date.now().toString(36)}`);
  await page.goto(PROFILE_PATH);

  const save = () =>
    submitAndSettle(
      page,
      formWith(page, "#phone").getByRole("button", { name: /Save business details/i }),
    );

  // A number nobody can dial, reported at the field rather than as a 500.
  await page.locator("#phone").fill("555-0134");
  await save();
  await expect(page.getByText(/10-digit US phone number/i)).toBeVisible();

  // §19.8 through the front door: the Reviews block says "Reviews" under the
  // business's own name, so the field only takes a Google address.
  await page.locator("#phone").fill("(512) 555-0134");
  await page.locator("#google_review_url").fill("https://example.com/glowing-reviews");
  await save();
  // Asserted on a string only the error carries — the field's label and its
  // hint both contain "Google review link", so that would pass either way.
  await expect(page.getByText(/maps\.app\.goo\.gl/i)).toBeVisible();

  await page.locator("#google_review_url").fill("https://g.page/r/CabcdEfgh/review");
  await save();
  await expect(banner(page, "status", /^Saved/i)).toBeVisible();
});
