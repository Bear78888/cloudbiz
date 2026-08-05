import { readFileSync } from "node:fs";

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
 * Sending an estimate by email (§16.9).
 *
 * The assertion that matters is the same shape as the sheet-sync invariant:
 * **the interface saying "Sent" must mean a message actually left the
 * building.** A test that only reads the banner would pass with no mail sent at
 * all. So this reads the stub's outbox and checks the message itself — who it
 * went to, in which language, and that the link in it opens the estimate.
 */

const STUB_STATE = process.env.RESEND_STUB_STATE ?? "/tmp/resend-stub.json";
const STUB_BASE = process.env.RESEND_API_BASE ?? "http://127.0.0.1:4546";

interface StubMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

function outbox(): StubMessage[] {
  try {
    return JSON.parse(readFileSync(STUB_STATE, "utf8")) as StubMessage[];
  } catch {
    return [];
  }
}

function messagesTo(address: string): StubMessage[] {
  return outbox().filter((message) => message.to === address);
}

test("approving then sending puts a real message in the outbox", async ({ page, browser }) => {
  const customerEmail = uniqueEmail("customer");
  await signUp(page, uniqueEmail("sender"));
  await createOrganization(page, `Email Test ${Date.now().toString(36)}`);

  await page.goto("/en/app/jobs/new");
  await page.locator("#customer_name").fill("Marta Delgado");
  await page.locator("#customer_email").fill(customerEmail);
  await page.locator("#title").fill("Water heater replacement");
  await formWith(page, "#customer_name").getByRole("button", { name: /Save job/i }).click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const jobUrl = page.url();

  await submitAndSettle(page, page.getByRole("button", { name: /Create estimate/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const estimateUrl = page.url();

  await page.locator("#item_description_0").fill("Water heater, installed");
  await page.locator("#item_unit_price_0").fill("1450");
  await submitAndSettle(
    page,
    formWith(page, "#title").getByRole("button", { name: /Save estimate/i }),
  );

  // §27.4: nothing goes out before approval. The send button is not even drawn
  // for a draft — and the server refuses regardless, which is the real rule.
  await page.goto(estimateUrl);
  await expect(page.getByRole("button", { name: /Send to customer/i })).toHaveCount(0);
  expect(messagesTo(customerEmail)).toHaveLength(0);

  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Send to customer/i }));

  await page.goto(estimateUrl);
  await expect(visibleText(page, "Sent")).toBeVisible();

  // The invariant: the screen said sent, so a message must exist.
  const sent = messagesTo(customerEmail);
  expect(sent, "the interface reported a send with nothing in the outbox").toHaveLength(1);

  const message = sent[0];
  expect(message.subject).toContain("Water heater replacement");
  expect(message.text).toContain("$1,450.00");
  expect(message.from).toContain("@");

  // The link in the email must be the one that opens the estimate — a field
  // with an external dependency, not a string we generated and never used.
  const link = message.text.match(/https?:\/\/\S+\/e\/en\/[A-Za-z0-9_-]{43}/)?.[0];
  expect(link, "the email carried no usable estimate link").toBeTruthy();

  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  const opened = await customer.goto(link as string);
  expect(opened?.status()).toBe(200);
  await expect(visibleText(customer, "Water heater, installed")).toBeVisible();
  await expect(visibleText(customer, "$1,450.00")).toBeVisible();
  await customerContext.close();

  // §16.11: the job followed, and the history says so.
  await page.goto(jobUrl);
  await expect(visibleText(page, "Estimate Sent")).toBeVisible();
});

test("a customer with no email address is told, not silently skipped", async ({ page }) => {
  await signUp(page, uniqueEmail("noemail"));
  await createOrganization(page, `No Email Test ${Date.now().toString(36)}`);

  const before = outbox().length;

  await createJob(page, { customer: "Nobody Reachable", title: "Fence repair" });
  await submitAndSettle(page, page.getByRole("button", { name: /Create estimate/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const estimateUrl = page.url();

  await page.locator("#item_description_0").fill("Fence panel");
  await page.locator("#item_unit_price_0").fill("300");
  await submitAndSettle(
    page,
    formWith(page, "#title").getByRole("button", { name: /Save estimate/i }),
  );
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));

  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Send to customer/i }));

  await expect(banner(page, "alert", /no email address/i)).toBeVisible();
  expect(outbox().length, "a message went out with no address to send to").toBe(before);

  // And the estimate did not pretend to have been sent.
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Approved")).toBeVisible();
  await expect(page.getByRole("button", { name: /Send to customer/i })).toBeVisible();
});

test("a provider failure leaves the estimate unsent rather than lying", async ({ page }) => {
  const customerEmail = uniqueEmail("bounces");
  await signUp(page, uniqueEmail("failsend"));
  await createOrganization(page, `Fail Send Test ${Date.now().toString(36)}`);

  await page.goto("/en/app/jobs/new");
  await page.locator("#customer_name").fill("Unlucky Customer");
  await page.locator("#customer_email").fill(customerEmail);
  await page.locator("#title").fill("Drain cleaning");
  await formWith(page, "#customer_name").getByRole("button", { name: /Save job/i }).click();
  await page.waitForURL(/\/en\/app\/jobs\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  await submitAndSettle(page, page.getByRole("button", { name: /Create estimate/i }));
  await page.waitForURL(/\/estimates\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const estimateUrl = page.url();

  await page.locator("#item_description_0").fill("Drain cleaning");
  await page.locator("#item_unit_price_0").fill("180");
  await submitAndSettle(
    page,
    formWith(page, "#title").getByRole("button", { name: /Save estimate/i }),
  );
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));

  // Arm the stub to refuse the next message.
  await page.request.post(`${STUB_BASE}/__stub/fail-next`);

  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Send to customer/i }));

  await expect(banner(page, "alert", /didn't go out/i)).toBeVisible();
  expect(messagesTo(customerEmail)).toHaveLength(0);

  // The estimate stays approved, so the owner can try again. An estimate
  // marked sent after a failed send would be a lie the owner cannot undo.
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Approved")).toBeVisible();

  // And retrying works, which is the point of not having moved the status.
  await submitAndSettle(page, page.getByRole("button", { name: /Send to customer/i }));
  await page.goto(estimateUrl);
  await expect(visibleText(page, "Sent")).toBeVisible();
  expect(messagesTo(customerEmail)).toHaveLength(1);
});
