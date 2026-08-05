import { expect, test } from "@playwright/test";

import {
  banner,
  createJob,
  createOrganization,
  formWith,
  signUp,
  submitAndSettle,
  uniqueEmail,
  visibleText,
} from "./helpers";

/**
 * The customer-facing estimate link (§16).
 *
 * This is the first surface of the product a stranger can reach, so the spec is
 * as much about what the page does *not* do as about what it shows. The
 * customer here is a fresh browser context with no session at all — the same
 * position as someone forwarded the link.
 */

const CUSTOMER = {
  name: "Marta Delgado",
  phone: "(512) 555-0181",
  email: "marta.delgado@example.test",
};

/** Signs up an owner and gets an approved, sent estimate. Returns its link. */
async function sendAnEstimate(page: import("@playwright/test").Page, total: string) {
  await signUp(page, uniqueEmail("public-est"));
  await createOrganization(page, `Public Link Test ${Date.now().toString(36)}`);

  const jobUrl = await createJob(page, {
    customer: CUSTOMER.name,
    phone: CUSTOMER.phone,
    title: "Water heater replacement",
  });

  await submitAndSettle(page, page.getByRole("button", { name: /Create estimate/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const estimateUrl = page.url();

  await page.locator("#item_description_0").fill("Water heater, installed");
  await page.locator("#item_unit_price_0").fill(total);
  await submitAndSettle(
    page,
    formWith(page, "#title").getByRole("button", { name: /Save estimate/i }),
  );

  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Mark as sent/i }));

  await page.goto(estimateUrl);
  const link = await page.locator("#customer-link").inputValue();
  return { link, estimateUrl, jobUrl };
}

test("the customer opens the link, sees only the estimate, and accepts", async ({
  page,
  browser,
}) => {
  const { link, estimateUrl, jobUrl } = await sendAnEstimate(page, "1450");

  expect(link).toMatch(/\/e\/en\/[A-Za-z0-9_-]{43}$/);

  // A different browser context: no cookies, no session — a stranger with a URL.
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await customer.goto(link);

  await expect(visibleText(customer, "Water heater, installed")).toBeVisible();
  await expect(visibleText(customer, "$1,450.00")).toBeVisible();

  // What the page must NOT contain. These are the fields a leaked link would
  // hand to whoever it reached.
  const body = (await customer.locator("body").innerText()).toLowerCase();
  for (const secret of [CUSTOMER.phone, CUSTOMER.email, "5125550181"]) {
    expect(body, `the public page leaked ${secret}`).not.toContain(secret.toLowerCase());
  }
  // No marketing chrome. This page is the pro's document, not an advertisement
  // for the platform stapled to it — and a "Sign In" link on a page sent to
  // someone else's customer is a question they should never have to ask.
  for (const chrome of ["job tracker", "sign in", "pricing", "choose my tools", "all tools"]) {
    expect(body, `the customer's page shows platform chrome: "${chrome}"`).not.toContain(chrome);
  }
  await expect(customer.locator("header")).toHaveCount(0);
  await expect(customer.locator("footer")).toHaveCount(0);
  await expect(customer.locator('a[href*="/app/"]')).toHaveCount(0);
  await expect(customer.locator('a[href*="/sign-in"]')).toHaveCount(0);

  // noindex, so a forwarded link never turns into a search result.
  await expect(customer.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i,
  );

  await submitAndSettle(customer, customer.getByRole("button", { name: /Accept this estimate/i }));
  await customer.goto(link);
  await expect(banner(customer, "status", /accepted this estimate/i)).toBeVisible();

  // Answering twice must not overwrite the answer.
  await expect(customer.getByRole("button", { name: /Accept this estimate/i })).toHaveCount(0);
  await expect(customer.getByRole("button", { name: /Decline/i })).toHaveCount(0);

  // §16.11: the owner's side followed along.
  await page.goto(jobUrl);
  await expect(visibleText(page, "Estimate Accepted")).toBeVisible();
  await expect(visibleText(page, "$1,450.00")).toBeVisible();

  await page.goto(estimateUrl);
  await expect(visibleText(page, "Accepted")).toBeVisible();

  await customerContext.close();
});

test("a wrong token gives nothing away", async ({ page, browser }) => {
  const { link } = await sendAnEstimate(page, "300");

  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();

  // Same shape, different value: the one guess an attacker can actually make.
  const realToken = link.split("/").pop() ?? "";
  const forged = `${realToken.slice(0, 42)}${realToken.endsWith("A") ? "B" : "A"}`;
  expect(forged).toHaveLength(43);

  const forgedResponse = await visitor.goto(link.replace(realToken, forged));
  expect(forgedResponse?.status()).toBe(404);

  // Malformed input never reaches a query, and still 404s rather than erroring.
  for (const junk of ["short", "../../etc/passwd", "%27%20or%201=1--"]) {
    const response = await visitor.goto(`${new URL(link).origin}/e/en/${junk}`);
    expect(response?.status(), `"${junk}" should be a plain 404`).toBe(404);
  }

  await visitorContext.close();
});

test("withdrawing the estimate kills the link", async ({ page, browser }) => {
  const { link, estimateUrl } = await sendAnEstimate(page, "780");

  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();

  // It works before the owner withdraws it.
  const before = await customer.goto(link);
  expect(before?.status()).toBe(200);

  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Mark expired/i }));

  // And afterwards the token is not merely refused — it no longer exists, so
  // the customer's link is indistinguishable from one that was never issued.
  const after = await customer.goto(link);
  expect(after?.status()).toBe(404);

  // The owner's own page still shows the estimate; withdrawing is not deleting.
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Expired")).toBeVisible();
  await expect(visibleText(page, "$780.00")).toBeVisible();

  await customerContext.close();
});

test("a declined estimate stays readable and cannot be re-answered", async ({ page, browser }) => {
  const { link, jobUrl } = await sendAnEstimate(page, "220");

  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await customer.goto(link);
  await submitAndSettle(customer, customer.getByRole("button", { name: /Decline/i }));

  await customer.goto(link);
  await expect(banner(customer, "status", /declined this estimate/i)).toBeVisible();
  await expect(visibleText(customer, "$220.00")).toBeVisible();
  await expect(customer.getByRole("button", { name: /Accept this estimate/i })).toHaveCount(0);

  // Declining is not the job going away (§16.11) — it stays where it was.
  await page.goto(jobUrl);
  await expect(visibleText(page, "Estimate Sent")).toBeVisible();

  await customerContext.close();
});
