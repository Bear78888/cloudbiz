import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the end-to-end suite.
 *
 * Every account is created fresh per test run: these tests write real rows
 * through real RLS, so sharing an account between runs would make one run's
 * leftovers another run's mystery failure.
 */

export function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${stamp}@handyalliance.test`;
}

export const TEST_PASSWORD = "e2e-Test-Password-2026";

/**
 * Forms are located by a field they own. The locale layout wraps everything in
 * one <main> and the app shell adds its own header form (sign out) inside it,
 * so "the form in main" is ambiguous on every signed-in page.
 */
export function formWith(page: Page, fieldId: string) {
  return page.locator(`form:has(${fieldId})`);
}

/** Signs up through the real UI and lands on onboarding (§10.1, §10.3). */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-up");
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-password").fill(TEST_PASSWORD);
  await formWith(page, "#signup-email").getByRole("button", { name: /Create Account/i }).click();
  await page.waitForURL(/\/en\/onboarding/, { timeout: 30_000 });
}

/** Completes onboarding, which is what creates the organization (§10.2). */
export async function createOrganization(page: Page, name: string): Promise<void> {
  await page.locator("#business_name").fill(name);
  await page.locator("#trade").selectOption("plumbing");
  await formWith(page, "#business_name").getByRole("button", { name: /Create my workspace/i }).click();
  await page.waitForURL(/\/en\/app(\?|$|\/)/, { timeout: 30_000 });
  // The dashboard only renders once the organization exists, so this turns a
  // failed creation into "onboarding did not complete" instead of a puzzling
  // missing element three navigations later.
  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
}

export interface JobInput {
  customer: string;
  phone?: string;
  title: string;
  status?: string;
  scheduledStart?: string;
  jobTotal?: string;
}

/** Fills and submits the job form, returning the new job's URL. */
export async function createJob(page: Page, job: JobInput): Promise<string> {
  await page.goto("/en/app/jobs/new");
  await page.locator("#customer_name").fill(job.customer);
  if (job.phone) await page.locator("#customer_phone").fill(job.phone);
  await page.locator("#title").fill(job.title);
  if (job.status) await page.locator("#status").selectOption(job.status);
  if (job.scheduledStart) await page.locator("#scheduled_start").fill(job.scheduledStart);
  if (job.jobTotal) await page.locator("#job_total").fill(job.jobTotal);

  await formWith(page, "#customer_name").getByRole("button", { name: /Save job/i }).click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return page.url();
}
