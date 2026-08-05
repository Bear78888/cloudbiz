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
 * The scenario that matters most (§37.3 A): sign up → set up the company →
 * add a job → move it through a status. If this path breaks, the product is
 * unusable no matter what else is green.
 */

test.describe.configure({ mode: "serial" });

test("sign up, create the company, add a job, change its status", async ({ page }) => {
  await signUp(page, uniqueEmail("e2e-tracker"));
  await createOrganization(page, "E2E Plumbing");

  // A fresh tracker states plainly that it is empty (§29).
  await page.goto("/en/app/jobs");
  await expect(page.getByRole("heading", { name: "Job Tracker" })).toBeVisible();
  await expect(page.getByText("No jobs yet")).toBeVisible();

  // §13.11: the first record takes under a minute. The assertion is on the
  // work being possible in a handful of fields, not on wall-clock timing,
  // which would be flaky on a loaded runner.
  const jobUrl = await createJob(page, {
    customer: "John Smith",
    phone: "(310) 555-0101",
    title: "Faucet replacement",
    status: "estimate_sent",
    scheduledStart: "2026-08-07T14:00",
    jobTotal: "280",
  });

  await expect(page.getByRole("heading", { name: "Faucet replacement" })).toBeVisible();
  await expect(visibleText(page, "John Smith")).toBeVisible();
  await expect(visibleText(page, "Estimate Sent")).toBeVisible();
  await expect(visibleText(page, "$280.00")).toBeVisible();
  // The schedule is shown in the organization's time zone, not the server's.
  await expect(page.getByText(/2:00\s?PM/).first()).toBeVisible();
  // §13.11: the change is in the job's history.
  await expect(page.getByText("Job created")).toBeVisible();

  // Status change from the card (§13.8).
  await page.locator("#status-change").selectOption("scheduled");
  await submitAndSettle(page, page.locator('form:has(#status-change)').getByRole("button"));
  await expect(page.getByText(/Status changed from .+ to .+/)).toBeVisible();

  // The list reflects it, and the view it belongs to lists it.
  await page.goto("/en/app/jobs?view=scheduled");
  await expect(visibleText(page, "Faucet replacement")).toBeVisible();
  await page.goto("/en/app/jobs?view=lost");
  await expect(page.getByText("Faucet replacement")).toHaveCount(0);

  expect(jobUrl).toMatch(/\/en\/app\/jobs\/[0-9a-f-]{36}$/);
});

test("search, bulk status change, soft delete and restore", async ({ page }) => {
  await signUp(page, uniqueEmail("e2e-bulk"));
  await createOrganization(page, "E2E Bulk Plumbing");

  await createJob(page, { customer: "Ana Ruiz", phone: "3105550303", title: "AC tune-up" });
  await createJob(page, { customer: "Maria Lopez", phone: "3105550202", title: "Deep clean" });

  // Search finds a customer by a phone typed in a different format than stored.
  await page.goto("/en/app/jobs?q=310-555-0303");
  await expect(visibleText(page, "AC tune-up")).toBeVisible();
  await expect(page.getByText("Deep clean")).toHaveCount(0);

  // A search that matches nothing says so, rather than looking broken (§29).
  await page.goto("/en/app/jobs?q=zzz-no-such-customer");
  await expect(page.getByText("Nothing matches those filters")).toBeVisible();

  // Bulk status change (§13.8): select everything, apply one status.
  await page.goto("/en/app/jobs");
  // Both layouts are in the DOM and one is hidden with CSS (§13.9), so each
  // job has two checkboxes — drive only the one on screen.
  const checkboxes = page.locator('input[name="job_ids"]:visible');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i += 1) await checkboxes.nth(i).check();
  await page.locator("#bulk-status").selectOption("completed");
  await submitAndSettle(page, page.getByRole("button", { name: "Apply to selected" }));

  await page.goto("/en/app/jobs?view=completed");
  await expect(visibleText(page, "AC tune-up")).toBeVisible();
  await expect(visibleText(page, "Deep clean")).toBeVisible();

  // Soft delete keeps the row and its history (§14.12).
  await page.goto("/en/app/jobs");
  await page.getByRole("link", { name: "Open" }).first().click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/);
  const deletedJobUrl = page.url();
  await submitAndSettle(page, page.locator('form:has(input[name="deleted"])').getByRole("button"));

  // The deleted job is listed under the Deleted filter and nowhere else.
  await page.goto("/en/app/jobs?deleted=1");
  await expect(
    page.getByText("Deleted", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  // The bulk bar is not offered here: a deleted job is restored, not restatused.
  await expect(page.locator("#bulk-status")).toHaveCount(0);

  await page.goto(deletedJobUrl);
  await expect(page.getByText("This job is deleted.")).toBeVisible();
  await submitAndSettle(page, page.locator('form:has(input[name="deleted"])').getByRole("button"));
  await expect(page.getByText("This job is deleted.")).toHaveCount(0);
  await expect(page.getByText("Job restored")).toBeVisible();
});

/**
 * Editing an existing job — the plainest thing a user does after creating one,
 * and the one path none of the specs above touch. Create, status change and
 * soft delete each take their own branch in the activity trigger; a field edit
 * takes the branch none of them reach, and that branch was broken outright
 * (see 20260804000910). The edit failed, the user got an error instead of a
 * saved change, and every other check stayed green.
 */
test("editing a job saves the change and records what changed", async ({ page }) => {
  await signUp(page, uniqueEmail("e2e-edit"));
  await createOrganization(page, "E2E Edit Plumbing");

  await createJob(page, {
    customer: "Maria Lopez",
    phone: "(310) 555-0144",
    title: "Water heater install",
    jobTotal: "500",
  });

  await page.getByRole("link", { name: "Edit" }).click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}\/edit$/);

  await page.locator("#title").fill("Water heater install (rev 2)");
  await page.locator("#job_total").fill("620");
  await formWith(page, "#title").getByRole("button", { name: /Save job/i }).click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // The edit persisted...
  await expect(
    page.getByRole("heading", { name: "Water heater install (rev 2)" }),
  ).toBeVisible();
  await expect(visibleText(page, "$620.00")).toBeVisible();
  // ...and the list agrees, so this is the stored row and not a stale render.
  await page.goto("/en/app/jobs");
  await expect(visibleText(page, "Water heater install (rev 2)")).toBeVisible();
});

test("the form explains what is wrong instead of failing silently", async ({ page }) => {
  await signUp(page, uniqueEmail("e2e-validation"));
  await createOrganization(page, "E2E Validation Plumbing");

  await page.goto("/en/app/jobs/new");
  await page.locator("#customer_name").fill("Bad Input");
  await page.locator("#title").fill("Bad amount");
  await page.locator("#job_total").fill("abc");
  await formWith(page, "#customer_name").getByRole("button", { name: /Save job/i }).click();

  await expect(page.getByText("Enter an amount like 280 or 280.50.")).toBeVisible();
  // Nothing was saved: the tracker is still empty.
  await page.goto("/en/app/jobs");
  await expect(page.getByText("No jobs yet")).toBeVisible();
});
