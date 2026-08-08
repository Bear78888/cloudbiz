import { expect, test } from "@playwright/test";

import {
  banner,
  createOrganization,
  formWith,
  signUp,
  submitAndSettle,
  uniqueEmail,
  visibleText,
} from "./helpers";

/**
 * The published website end to end (§19.4, §19.6, §19.10).
 *
 * The assertion this spec exists for is the branding one. §19 says the site
 * carries the tradesperson's brand and advertises nothing of ours, and that is
 * a rule about markup that only a rendered page can prove. The same mistake has
 * already been made once, on the customer's copy of an estimate, and was caught
 * by exactly this kind of test — the page came wrapped in our header, our
 * footer and a Sign In link.
 *
 * The visitor is a fresh browser context with no session: a stranger with a URL.
 */

const PROFILE_PATH = "/en/app/settings/business";
const WEBSITE_PATH = "/en/app/settings/website";

/** Fills in the minimum a site needs before it may be published (§19.10). */
async function makeSitePublishable(page: import("@playwright/test").Page, stamp: string) {
  await page.goto(PROFILE_PATH);
  await page.locator("#phone").fill("(512) 555-0134");
  await page.locator("#email").fill(`shop-${stamp}@handyalliance.test`);
  await page.locator("#zip_codes").fill("78701");
  await page.locator("#cities").fill("Austin");
  await page.getByRole("button", { name: "+ Drain cleaning" }).click();
  await submitAndSettle(
    page,
    formWith(page, "#phone").getByRole("button", { name: /Save business details/i }),
  );

  await page.goto(WEBSITE_PATH);
  await page.locator("#headline").fill("Licensed plumbing, same-day service");
  await page.locator("#why_choose_us").fill("Licensed and insured\nUpfront pricing");
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));
}

test("a published site is the contractor's page and advertises nothing of ours", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("public-site"));
  await createOrganization(page, `Public Site ${stamp}`);
  const slug = `public-site-${stamp}`;

  await makeSitePublishable(page, stamp);

  // §19.10: preview before publish, rendered by the same code as the real page.
  await page.goto(WEBSITE_PATH);
  await page.getByRole("link", { name: /^Preview$/ }).click();
  await page.waitForURL(/\/settings\/website\/preview/, { timeout: 30_000 });
  await expect(visibleText(page, "Licensed plumbing, same-day service")).toBeVisible();
  await expect(visibleText(page, "Preview — not published")).toBeVisible();

  // Still nothing public before Publish is pressed.
  const early = await page.request.get(`/pro/${slug}/en`, { maxRedirects: 0 });
  expect(early.status()).toBe(404);

  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, page.getByRole("button", { name: /^Publish$/ }));
  await expect(banner(page, "status", /live/i)).toBeVisible();

  // A stranger with the address: no cookies, no session.
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/pro/${slug}/en`);

  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Licensed plumbing, same-day service",
  );
  await expect(visibleText(visitor, `Public Site ${stamp}`)).toBeVisible();
  await expect(visibleText(visitor, "Drain cleaning")).toBeVisible();
  await expect(visibleText(visitor, "Licensed and insured")).toBeVisible();
  await expect(visitor.locator('a[href^="tel:"]').first()).toBeVisible();

  // The rule this spec exists for.
  const body = (await visitor.locator("body").innerText()).toLowerCase();
  for (const chrome of [
    "handyalliance",
    "job tracker",
    "sign in",
    "choose my tools",
    "all tools",
    "estimate & quote maker",
  ]) {
    expect(body, `the contractor's site shows our chrome: "${chrome}"`).not.toContain(chrome);
  }
  await expect(visitor.locator('a[href*="/app/"]')).toHaveCount(0);
  await expect(visitor.locator('a[href*="/sign-in"]')).toHaveCount(0);
  await expect(visitor.locator('a[href*="/pricing"]')).toHaveCount(0);

  // §19.8: nothing invented. No review block without a review link, no service
  // area beyond what was typed, and no section left standing empty.
  expect(body).not.toContain("read reviews on google");
  expect(body).toContain("austin");

  // Unlike the estimate link, this page is meant to be found (§19.8).
  await expect(visitor.locator('meta[name="robots"]')).toHaveCount(0);

  // Taking it down makes the address stop working, and keeps the content.
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, page.getByRole("button", { name: /Take it down/i }));
  await expect(banner(page, "status", /taken down/i)).toBeVisible();
  await expect(page.locator("#headline")).toHaveValue("Licensed plumbing, same-day service");

  const afterWithdrawal = await visitor.request.get(`/pro/${slug}/en`, { maxRedirects: 0 });
  expect(afterWithdrawal.status()).toBe(404);
});

test("an unfinished site cannot be published, and an unknown address gives nothing away", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("public-site-gate"));
  await createOrganization(page, `Unfinished ${stamp}`);

  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));

  // The readiness list is not advice: Publish is refused while it has entries.
  await page.goto(WEBSITE_PATH);
  await expect(page.getByRole("button", { name: /^Publish$/ })).toBeDisabled();

  // A slug nobody has and a slug that exists but is unpublished are the same
  // answer — telling them apart would confirm the business exists.
  const unknown = await page.request.get("/pro/no-such-business-here/en", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
  const unpublished = await page.request.get(`/pro/unfinished-${stamp}/en`, { maxRedirects: 0 });
  expect(unpublished.status()).toBe(404);
  // Including the bare address, which would otherwise redirect and confirm it.
  const bare = await page.request.get(`/pro/unfinished-${stamp}`, { maxRedirects: 0 });
  expect(bare.status()).toBe(404);
});
