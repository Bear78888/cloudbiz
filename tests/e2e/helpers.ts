import type { Page } from "@playwright/test";

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

/** The dashboard shell has its own submit button (sign out) — always scope. */
export function mainForm(page: Page) {
  return page.locator("main form");
}

/** Signs up through the real UI and lands on onboarding (§10.1, §10.3). */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/sign-up");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(/\/en\/onboarding/, { timeout: 30_000 });
}

/** Completes onboarding, which is what creates the organization (§10.2). */
export async function createOrganization(page: Page, name: string): Promise<void> {
  await page.locator("#business_name").fill(name);
  await page.locator("#trade").selectOption("plumbing");
  await mainForm(page).getByRole("button", { name: /Create my workspace/i }).click();
  await page.waitForURL(/\/en\/app(\?|$|\/)/, { timeout: 30_000 });
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

  await mainForm(page).getByRole("button", { name: /Save job/i }).click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return page.url();
}
