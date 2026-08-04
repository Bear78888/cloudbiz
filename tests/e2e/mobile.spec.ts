import { expect, test } from "@playwright/test";

import { createJob, createOrganization, signUp, uniqueEmail, visibleText } from "./helpers";

/**
 * §13.9 is explicit that a phone must not be given the wide desktop table as
 * the only way to work, and §38.5 makes mobile an acceptance criterion. This
 * runs in the `mobile` project (Pixel 7 viewport), so it is a real narrow
 * screen rather than a CSS class assertion.
 */

test("on a phone the list is cards, not a wide table", async ({ page }) => {
  await signUp(page, uniqueEmail("e2e-mobile"));
  await createOrganization(page, "E2E Mobile Plumbing");

  await createJob(page, {
    customer: "John Smith",
    phone: "3105550101",
    title: "Faucet replacement",
    status: "estimate_sent",
    jobTotal: "280",
  });

  await page.goto("/en/app/jobs");

  // The desktop table exists in the markup but must not be shown here.
  await expect(page.locator("table")).toBeHidden();

  // The card carries what a pro reads while standing in someone's kitchen.
  await expect(visibleText(page, "John Smith")).toBeVisible();
  await expect(visibleText(page, "Faucet replacement")).toBeVisible();
  await expect(visibleText(page, "Estimate Sent")).toBeVisible();
  await expect(visibleText(page, "$280.00")).toBeVisible();

  // Nothing overflows the viewport sideways (§8.1, §38.5).
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows).toBe(false);

  // Tapping the card opens the job.
  await visibleText(page, "Faucet replacement").click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Faucet replacement" })).toBeVisible();
});

test("the Spanish interface works on a phone too", async ({ page }) => {
  await signUp(page, uniqueEmail("e2e-mobile-es"));
  await createOrganization(page, "E2E Mobile ES");

  await createJob(page, { customer: "Ana Ruiz", title: "Cambio de llave", status: "scheduled" });

  await page.goto("/es/app/jobs");
  await expect(page.getByRole("heading", { name: "Seguimiento de trabajos" })).toBeVisible();
  await expect(visibleText(page, "Programado")).toBeVisible();
  await expect(page.locator("table")).toBeHidden();
});
