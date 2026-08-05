import { expect, test } from "@playwright/test";

import {
  createJob,
  createOrganization,
  formWith,
  signUp,
  submitAndSettle,
  uniqueEmail,
  visibleText,
} from "./helpers";

/**
 * Estimate Maker end to end (§16).
 *
 * The point of this spec is the approval gate: §16.5 says nothing reaches a
 * customer without the owner confirming the price, and a rule like that is only
 * real if it is checked against a running application. Everything here goes
 * through the real forms, the real server actions and real RLS.
 */

test("an estimate cannot leave the office without being approved", async ({ page }) => {
  await signUp(page, uniqueEmail("estimates"));
  await createOrganization(page, `Estimate Test ${Date.now().toString(36)}`);

  const jobUrl = await createJob(page, {
    customer: "Dana Ruiz",
    title: "Kitchen faucet replacement",
  });

  // The job card offers an estimate, and creating one opens it as a draft.
  await submitAndSettle(page, page.getByRole("button", { name: /Create estimate/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const estimateUrl = page.url();
  await expect(visibleText(page, "Draft")).toBeVisible();

  // A draft with no lines has nothing to approve. The refusal is the assertion:
  // if this ever succeeds, an empty estimate can be put in front of a customer.
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));
  await page.waitForURL(/blocked=/, { timeout: 30_000 });
  await expect(page.getByRole("alert")).toContainText(/at least one line/i);

  // Fill in two lines and a tax rate.
  await page.goto(estimateUrl);
  await page.locator("#item_description_0").fill("Labor, 2 hours");
  await page.locator("#item_quantity_0").fill("2");
  await page.locator("#item_unit_price_0").fill("90");
  await page.locator("#item_type_1").selectOption("material");
  await page.locator("#item_description_1").fill("Faucet");
  await page.locator("#item_unit_price_1").fill("120.50");
  await page.locator("#tax_rate").fill("8.25");

  // The running total is computed by the same function the server stores from,
  // so the number on screen before saving is the number that gets written.
  await expect(visibleText(page, "$325.29")).toBeVisible();

  await submitAndSettle(page, formWith(page, "#title").getByRole("button", { name: /Save estimate/i }));
  await expect(page.getByRole("status")).toContainText(/Saved/i);

  // Saved totals, not form totals: reload from the database and check.
  await page.goto(estimateUrl);
  await expect(visibleText(page, "$325.29")).toBeVisible();

  // Now approval goes through, and only now is there a way to send.
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Approved")).toBeVisible();

  await submitAndSettle(page, page.getByRole("button", { name: /Mark as sent/i }));
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Sent")).toBeVisible();

  // A sent estimate is a document, not a draft: the editor is gone (§25.3).
  await expect(page.locator("#item_description_0")).toHaveCount(0);

  // §16.11: the job follows the estimate.
  await page.goto(jobUrl);
  await expect(visibleText(page, "Estimate Sent")).toBeVisible();

  // Accepting writes the amount onto the job, so the owner never retypes the
  // number they will be paid.
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Customer accepted/i }));
  await page.goto(jobUrl);
  await expect(visibleText(page, "Estimate Accepted")).toBeVisible();
  await expect(visibleText(page, "$325.29")).toBeVisible();

  // And a second estimate for the same job is a new version, not an edit.
  await submitAndSettle(page, page.getByRole("button", { name: /New version/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(visibleText(page, "v2")).toBeVisible();
  await page.goto(jobUrl);
  await expect(visibleText(page, "v1")).toBeVisible();
});

test("editing an approved estimate withdraws the approval", async ({ page }) => {
  await signUp(page, uniqueEmail("estimates-reapprove"));
  await createOrganization(page, `Reapprove Test ${Date.now().toString(36)}`);

  await createJob(page, { customer: "Sam Okafor", title: "Water heater" });
  await submitAndSettle(page, page.getByRole("button", { name: /Create estimate/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const estimateUrl = page.url();

  await page.locator("#item_description_0").fill("Water heater install");
  await page.locator("#item_unit_price_0").fill("1200");
  await submitAndSettle(page, formWith(page, "#title").getByRole("button", { name: /Save estimate/i }));

  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Approved")).toBeVisible();

  // Changing the price after approval must not leave the estimate approved:
  // "approved" means "I checked these figures", and these are not those figures.
  await page.locator("#item_unit_price_0").fill("1500");
  await submitAndSettle(page, formWith(page, "#title").getByRole("button", { name: /Save estimate/i }));

  await page.goto(estimateUrl);
  await expect(visibleText(page, "Draft")).toBeVisible();
  await expect(page.getByRole("button", { name: /Mark as sent/i })).toHaveCount(0);
});
