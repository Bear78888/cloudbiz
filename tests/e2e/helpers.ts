import { expect, type Locator, type Page } from "@playwright/test";

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

/**
 * Clicks a submit button and waits for the server action to actually finish.
 *
 * `waitForURL` is the wrong tool when an action redirects back to the page it
 * started on — status change, soft delete, restore, bulk update. The URL
 * already matches, so the wait resolves *before* the POST has even left the
 * browser, and the `reload()` or `goto()` that follows aborts the request
 * mid-flight. Next.js logs "The destination stream closed early", the write
 * never lands, and the test fails on a later assertion that looks unrelated to
 * the real cause. Waiting for the response instead means the action has been
 * processed before anything else touches the page.
 */
export async function submitAndSettle(page: Page, submit: Locator): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === "POST" && response.status() < 500,
      { timeout: 30_000 },
    ),
    submit.click(),
  ]);
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

/**
 * The first *visible* node with this text.
 *
 * Two things on these pages make a bare `.first()` unreliable: the list
 * renders both layouts and hides one with CSS (§13.9), and the bulk status
 * form contains an <option> for every status name. Both are legitimately in
 * the DOM and neither is on screen, so assertions must say which they mean.
 */
export function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

/**
 * A banner with the given text, by role.
 *
 * `getByRole("alert")` alone is ambiguous on every page: Next.js renders
 * `#__next-route-announcer__` with `role="alert"` to announce navigations, so
 * a bare alert locator matches two elements and fails on strict mode — with an
 * error about the announcer, which reads like the assertion was wrong rather
 * than the locator. Naming the text says which banner is meant, and still fails
 * if the banner never appears.
 */
export function banner(page: Page, role: "alert" | "status", text: RegExp) {
  return page.getByRole(role).filter({ hasText: text });
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
