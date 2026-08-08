import { expect, test } from "@playwright/test";

import {
  createOrganization,
  formWith,
  signUp,
  submitAndSettle,
  uniqueEmail,
  visibleText,
} from "./helpers";

/**
 * The website lead form (§19.7).
 *
 * The assertion this spec exists for: **a stranger's enquiry becomes a job in
 * the owner's tracker**, with the source recorded, and it does so through the
 * only unauthenticated write path on the platform. A unit test can check the
 * parsing; only this can check that the whole path — published slug → service
 * role → customer → job → activity → the owner's list — actually joins up.
 *
 * The visitor is a fresh browser context with no session.
 */

const PROFILE_PATH = "/en/app/settings/business";
const WEBSITE_PATH = "/en/app/settings/website";

async function publishASite(page: import("@playwright/test").Page, stamp: string) {
  await page.goto(PROFILE_PATH);
  await page.locator("#phone").fill("(512) 555-0134");
  await page.locator("#email").fill(`shop-${stamp}@example.test`);
  await page.locator("#cities").fill("Austin");
  await page.getByRole("button", { name: "+ Drain cleaning" }).click();
  await submitAndSettle(
    page,
    formWith(page, "#phone").getByRole("button", { name: /Save business details/i }),
  );

  await page.goto(WEBSITE_PATH);
  await page.locator("#headline").fill("Licensed plumbing, same-day service");
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, page.getByRole("button", { name: /^Publish$/ }));
}

test("a stranger's enquiry becomes a job in the tracker", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("lead"));
  await createOrganization(page, `Lead Test ${stamp}`);
  const slug = `lead-test-${stamp}`;

  await publishASite(page, stamp);

  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/pro/${slug}/en`);

  // The service list is the owner's own, so nobody has to guess the wording of
  // someone else's trade.
  await expect(visitor.locator("#lead_service")).toBeVisible();
  await visitor.locator("#lead_name").fill("Dana Ruiz");
  await visitor.locator("#lead_phone").fill("(512) 555-0199");
  await visitor.locator("#lead_service").selectOption("Drain cleaning");
  await visitor.locator("#lead_zip").fill("78701");
  await visitor.locator("#lead_description").fill("Kitchen tap is dripping badly.");
  await visitor.locator("#lead_date").fill("2026-08-20");

  // §19.7's consent box is genuinely required, not decorative. The browser
  // refuses to submit without it, so there is no request to wait for — asserted
  // through validity rather than by clicking, because a native block sends
  // nothing at all. The server refuses an unticked box too (`parseLeadForm`),
  // which is what a crafted POST would meet.
  const consent = visitor.getByRole("checkbox");
  expect(await consent.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  expect(
    await visitor.locator("form").first().evaluate((el: HTMLFormElement) => el.checkValidity()),
  ).toBe(false);

  await consent.check();
  expect(await consent.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true);
  await submitAndSettle(visitor, visitor.getByRole("button", { name: /^Send$/ }));
  await expect(visitor.getByText(/on its way/i)).toBeVisible();

  // The payoff: it is in the owner's tracker, as a new lead from the website.
  await page.goto("/en/app/jobs");
  await expect(visibleText(page, "Dana Ruiz")).toBeVisible();
  await page.getByText("Drain cleaning").first().click();
  await page.waitForURL(/\/app\/jobs\/[0-9a-f-]{36}/, { timeout: 30_000 });

  await expect(visibleText(page, "Kitchen tap is dripping badly.")).toBeVisible();
  // The preferred date is in the description, never on the schedule: a date a
  // stranger typed is a request, not an appointment.
  await expect(visibleText(page, "2026-08-20")).toBeVisible();
  await expect(visibleText(page, "78701")).toBeVisible();
});

test("an unpublished site takes no leads, and the form refuses a page it was not served from", async ({
  page,
  browser,
}) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("lead-gate"));
  await createOrganization(page, `Lead Gate ${stamp}`);
  const slug = `lead-gate-${stamp}`;

  await publishASite(page, stamp);

  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/pro/${slug}/en`);

  // Take the site down while the visitor still has the form open. The
  // submission has to be refused: a form posted at a site that is no longer
  // public must not write into that business's job list.
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, page.getByRole("button", { name: /Take it down/i }));

  await visitor.locator("#lead_name").fill("Late Sender");
  await visitor.locator("#lead_phone").fill("(512) 555-0177");
  await visitor.getByRole("checkbox").check();
  await submitAndSettle(visitor, visitor.getByRole("button", { name: /^Send$/ }));
  await expect(visitor.getByText(/didn't send/i)).toBeVisible();

  await page.goto("/en/app/jobs");
  await expect(page.getByText("Late Sender")).toHaveCount(0);
});
