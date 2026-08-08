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
 * Published versions and rollback (§19.10).
 *
 * The assertion this spec exists for is the first one: **editing after
 * publishing does not change what the public reads.** That is the entire reason
 * a version is a snapshot rather than a pointer at the live rows, and it cannot
 * be shown by a unit test — it needs a real publish, a real edit, and a real
 * stranger fetching the page in between.
 *
 * The second is that rolling back never destroys anything: the version rolled
 * away from is still there to roll forward to.
 */

const PROFILE_PATH = "/en/app/settings/business";
const WEBSITE_PATH = "/en/app/settings/website";

async function setHeadline(page: import("@playwright/test").Page, headline: string) {
  await page.goto(WEBSITE_PATH);
  await page.locator("#headline").fill(headline);
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );
}

/**
 * Presses whichever button publishes right now.
 *
 * Two names on purpose: before the first publish it reads "Publish", after it
 * "Publish changes". They used to be one toggle that turned into "Take it
 * down", which meant an edit could never be published at all — caught here.
 */
async function publish(page: import("@playwright/test").Page) {
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, page.getByRole("button", { name: /^Publish( changes)?$/ }));
}

test("publishing freezes the page, and rollback destroys nothing", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("versions"));
  await createOrganization(page, `Versions Test ${stamp}`);
  const slug = `versions-test-${stamp}`;

  // The minimum a site needs before §19.10 will let it out.
  await page.goto(PROFILE_PATH);
  await page.locator("#phone").fill("(512) 555-0134");
  await page.locator("#email").fill(`shop-${stamp}@example.test`);
  await page.locator("#cities").fill("Austin");
  await page.getByRole("button", { name: "+ Drain cleaning" }).click();
  await submitAndSettle(
    page,
    formWith(page, "#phone").getByRole("button", { name: /Save business details/i }),
  );

  await setHeadline(page, "First published headline");
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));

  await publish(page);
  await expect(banner(page, "status", /live/i)).toBeVisible();
  await expect(visibleText(page, "Live version 1")).toBeVisible();
  // Publishing an edit has to stay possible once the site is live. The single
  // toggle that used to be here became "Take it down" and left no way to do it.
  await expect(page.getByRole("button", { name: /^Publish changes$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Take it down/i })).toBeVisible();

  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(`/pro/${slug}/en`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("First published headline");

  // The assertion this spec exists for. The draft changes; the public page does
  // not, because it is reading a snapshot rather than the live rows.
  await setHeadline(page, "Draft wording nobody approved");
  await visitor.reload();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("First published headline");

  // Publishing again is what moves it, and it becomes version 2.
  await publish(page);
  await expect(visibleText(page, "Live version 2")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Draft wording nobody approved",
  );

  // §19.10: roll back to the earlier version. The history now has two entries,
  // so the section appears and the live one is marked rather than removed.
  await page.goto(WEBSITE_PATH);
  const versions = page.getByRole("list", { name: /Published versions/i }).getByRole("listitem");
  await expect(versions).toHaveCount(2);
  await expect(versions.filter({ hasText: /Version 2/ })).toContainText(/Live now/i);

  await submitAndSettle(
    page,
    versions.filter({ hasText: /Version 1/ }).getByRole("button", { name: /Make this live/i }),
  );
  await expect(banner(page, "status", /live again/i)).toBeVisible();
  await expect(visibleText(page, "Live version 1")).toBeVisible();

  await visitor.reload();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("First published headline");

  // Nothing was deleted: version 2 is still there and can be made live again.
  await page.goto(WEBSITE_PATH);
  await expect(page.getByRole("list", { name: /Published versions/i }).getByRole("listitem")).toHaveCount(2);
  await submitAndSettle(
    page,
    page
      .getByRole("list", { name: /Published versions/i })
      .getByRole("listitem")
      .filter({ hasText: /Version 2/ })
      .getByRole("button", { name: /Make this live/i }),
  );
  await visitor.reload();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Draft wording nobody approved",
  );

  // Taking it down hides every version at once, and keeps them all.
  await page.goto(WEBSITE_PATH);
  await submitAndSettle(page, page.getByRole("button", { name: /Take it down/i }));
  const gone = await visitor.request.get(`/pro/${slug}/en`, { maxRedirects: 0 });
  expect(gone.status()).toBe(404);
  await page.goto(WEBSITE_PATH);
  await expect(page.getByRole("list", { name: /Published versions/i }).getByRole("listitem")).toHaveCount(2);
});
