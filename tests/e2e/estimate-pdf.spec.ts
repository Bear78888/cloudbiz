import { expect, test } from "@playwright/test";

import { sendAnEstimate } from "./helpers";

/**
 * The PDF download (§16.9) — one more way to reach the same document as the
 * web link and the email, not a fourth source of truth. Both routes render
 * from the same `EstimatePdfInput` shape the model already produces, so this
 * checks delivery (status code, content type, that bytes come back) rather
 * than re-testing content the unit tests in `estimate-pdf.test.ts` already
 * hold to account.
 */

test("the owner can preview a PDF of their own estimate, any status", async ({ page }) => {
  const { estimateUrl } = await sendAnEstimate(page, "500");
  // `sendAnEstimate` leaves the estimate `sent`, but the owner's PDF route has
  // no status gate (§16.5 approval is not the same question as "may I look").
  const pdfUrl = `${estimateUrl}/pdf`;

  const response = await page.request.get(pdfUrl);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  const body = await response.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("a signed-out request for someone else's estimate PDF is not found, not the PDF", async ({
  page,
  browser,
}) => {
  const { estimateUrl } = await sendAnEstimate(page, "500");
  const pdfUrl = `${estimateUrl}/pdf`;

  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  const response = await stranger.request.get(pdfUrl);
  // Same `notFound()` the page itself uses when there's no membership — a 404,
  // not a 200 with someone else's numbers in it.
  expect(response.status()).toBe(404);
  await strangerContext.close();
});

test("the customer can download the PDF from the public link", async ({ page, browser }) => {
  const { link } = await sendAnEstimate(page, "1450");
  const pdfUrl = `${link}/pdf`;

  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  const response = await customer.request.get(pdfUrl);

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  const body = await response.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  await customerContext.close();
});

test("a wrong token gets a 404 for the PDF too, same as the page", async ({ page, browser }) => {
  const { link } = await sendAnEstimate(page, "300");
  const realToken = link.split("/").pop() ?? "";
  const forged = `${realToken.slice(0, 42)}${realToken.endsWith("A") ? "B" : "A"}`;

  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  const response = await visitor.request.get(link.replace(realToken, forged) + "/pdf");
  expect(response.status()).toBe(404);
  await visitorContext.close();
});
