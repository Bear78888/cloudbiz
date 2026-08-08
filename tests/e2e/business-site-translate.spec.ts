import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { banner, createOrganization, formWith, signUp, submitAndSettle, uniqueEmail } from "./helpers";

/**
 * The bilingual site and its AI translation draft (§19.5).
 *
 * The assertion this spec exists for: a machine translation **cannot reach the
 * public on the model's say-so**. It arrives marked as a draft, the readiness
 * list refuses to publish while it is, and the owner's own save is what clears
 * it. Everything else here — the switch, the second page — is scaffolding for
 * that one rule.
 *
 * The model is stubbed. A real call would be slow, paid for, and differently
 * wrong each run.
 */

const STUB_BASE = process.env.AI_API_BASE ?? "http://127.0.0.1:4547";
const STUB_STATE = process.env.AI_STUB_STATE ?? "/tmp/ai-stub.json";
const WEBSITE_PATH = "/en/app/settings/website";
const PROFILE_PATH = "/en/app/settings/business";

interface StubRequest {
  model: string;
  system: string;
  user: string;
}

function sentToModel(): StubRequest[] {
  try {
    return JSON.parse(readFileSync(STUB_STATE, "utf8")) as StubRequest[];
  } catch {
    return [];
  }
}

const SPANISH_REPLY = JSON.stringify({
  headline: "Plomería con licencia, servicio el mismo día",
  subheadline: null,
  aboutText: "Negocio familiar desde 2009.",
  ctaText: "Pide un presupuesto gratis",
  serviceAreaNote: null,
  whyChooseUs: ["Con licencia y seguro"],
  faq: [],
});

/**
 * The stub is one process for the whole run, so this spec sets the reply it
 * needs rather than trusting whatever the previous file left behind — the
 * lesson from `estimate-voice.spec.ts`, which inherited another file's
 * override and failed on CI only.
 */
async function setStubReply(page: import("@playwright/test").Page, reply: string) {
  await page.request.post(`${STUB_BASE}/__stub/reply`, {
    data: reply,
    headers: { "content-type": "text/plain" },
  });
}

// And puts it back, so the next file in alphabetical order gets the default.
test.afterEach(async ({ page }) => {
  await page.request.post(`${STUB_BASE}/__stub/reply`, {
    data: JSON.stringify({
      scope: "Replace the leaking water heater and haul away the old unit.",
      items: [
        { item_type: "labor", description: "Installation, 3 hours", quantity: 3, unit_price: 95 },
        { item_type: "material", description: "40-gallon water heater", quantity: 1, unit_price: 780 },
      ],
      confidence: 0.82,
      assumptions: ["Standard 40-gallon tank", "Existing connections are to code"],
    }),
    headers: { "content-type": "text/plain" },
  });
});

test("a translated page stays unpublishable until a person confirms it", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("translate"));
  await createOrganization(page, `Translate Test ${stamp}`);

  // Enough profile that the only thing standing between this site and Publish
  // is the translation itself.
  await page.goto(PROFILE_PATH);
  await page.locator("#phone").fill("(512) 555-0134");
  await page.locator("#email").fill(`shop-${stamp}@example.test`);
  await page.locator("#cities").fill("Austin");
  await page.getByRole("button", { name: "+ Drain cleaning" }).click();
  await submitAndSettle(
    page,
    formWith(page, "#phone").getByRole("button", { name: /Save business details/i }),
  );

  // English first.
  await page.goto(WEBSITE_PATH);
  await page.locator("#headline").fill("Licensed plumbing, same-day service");
  await page.locator("#why_choose_us").fill("Licensed and insured");
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );

  // Offer the site in Spanish too (§19.5).
  await page.goto(WEBSITE_PATH);
  await page.getByRole("checkbox", { name: "Spanish", exact: true }).check();
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));

  // The Spanish page is empty, so the site is not ready.
  await page.goto(`${WEBSITE_PATH}?content=es`);
  await expect(page.getByText(/Write a headline/i)).toBeVisible();

  await setStubReply(page, SPANISH_REPLY);
  await submitAndSettle(page, page.getByRole("button", { name: /Draft this page from English/i }));
  await expect(banner(page, "status", /draft translation is ready/i)).toBeVisible();

  // The English copy reached the model as data inside the delimiter, never as
  // part of the system prompt (§27.3).
  const calls = sentToModel();
  const translation = calls[calls.length - 1];
  expect(translation.user).toContain("<source_copy>");
  expect(translation.user).toContain("Licensed plumbing, same-day service");
  expect(translation.system).not.toContain("Licensed plumbing, same-day service");

  // It landed in the editor, and it is marked as needing a read.
  await page.goto(`${WEBSITE_PATH}?content=es`);
  await expect(page.locator("#headline")).toHaveValue("Plomería con licencia, servicio el mismo día");
  await expect(page.getByText(/drafted automatically/i)).toBeVisible();

  // **The rule this spec exists for.** The headline is filled in, so that
  // blocker is gone — and the site still cannot be published, because nobody
  // has read the translation.
  await expect(page.getByText(/Write a headline/i)).toHaveCount(0);
  await expect(page.getByText(/translation is still waiting/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Publish$/ })).toBeDisabled();

  // Saving it is the confirmation. Nothing else is.
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );
  await page.goto(`${WEBSITE_PATH}?content=es`);
  await expect(page.getByText(/drafted automatically/i)).toHaveCount(0);
  await expect(page.getByText(/translation is still waiting/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Publish$/ })).toBeEnabled();
});

test("a model failure leaves the page as it was", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, uniqueEmail("translate-fail"));
  await createOrganization(page, `Translate Fail ${stamp}`);

  await page.goto(WEBSITE_PATH);
  await page.locator("#headline").fill("Licensed plumbing, same-day service");
  await submitAndSettle(
    page,
    formWith(page, "#headline").getByRole("button", { name: /Save content/i }),
  );
  await page.goto(WEBSITE_PATH);
  await page.getByRole("checkbox", { name: "Spanish", exact: true }).check();
  await submitAndSettle(page, formWith(page, "#slug").getByRole("button", { name: /Save settings/i }));

  await page.goto(`${WEBSITE_PATH}?content=es`);
  await page.request.post(`${STUB_BASE}/__stub/fail-next`);
  await submitAndSettle(page, page.getByRole("button", { name: /Draft this page from English/i }));

  // Said so, and changed nothing — not half a page in the wrong language.
  await expect(page.getByText(/translation didn't come back/i)).toBeVisible();
  await page.goto(`${WEBSITE_PATH}?content=es`);
  await expect(page.locator("#headline")).toHaveValue("");
  await expect(page.getByText(/drafted automatically/i)).toHaveCount(0);
});
