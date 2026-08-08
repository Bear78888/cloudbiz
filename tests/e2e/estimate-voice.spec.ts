import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { banner, formWith, newDraftEstimate, submitAndSettle } from "./helpers";

/**
 * The voice note (§16.3, §16.12): a second way to fill in the same
 * description field the AI draft already reads from, not a separate feature
 * with its own rules. The provider is a stub, for the same reason as the
 * drafting model in estimate-ai.spec.ts — no test calls a real one.
 *
 * What matters here is the shape of the trust boundary: the transcript lands
 * in a textarea the owner can still edit, never straight into a draft, and a
 * provider failure changes nothing rather than leaving a half state.
 */

const STUB_BASE = process.env.TRANSCRIBE_API_BASE ?? "http://127.0.0.1:4548";
const STUB_STATE = process.env.TRANSCRIBE_STUB_STATE ?? "/tmp/transcribe-stub.json";
// The AI-drafting stub (ai-stub.mjs) is one long-lived process for the whole
// run, and its `nextReply` is deliberately settable per test (estimate-ai.spec.ts
// uses that to test a low-confidence draft) — which also means it is *global*,
// not scoped to a file. A test here that submits "Write a draft" without
// stating its own expected reply is really asserting on whatever the last
// spec file to touch the stub left behind, not on this test's own setup.
const AI_STUB_BASE = process.env.AI_API_BASE ?? "http://127.0.0.1:4547";
const AI_DEFAULT_REPLY = JSON.stringify({
  scope: "Replace the leaking water heater and haul away the old unit.",
  items: [
    { item_type: "labor", description: "Installation, 3 hours", quantity: 3, unit_price: 95 },
    { item_type: "material", description: "40-gallon water heater", quantity: 1, unit_price: 780 },
  ],
  confidence: 0.82,
  assumptions: ["Standard 40-gallon tank", "Existing connections are to code"],
});

interface StubRequest {
  model: string;
  language: string | null;
  file: { filename: string; size: number } | null;
}

function sentToProvider(): StubRequest[] {
  try {
    return JSON.parse(readFileSync(STUB_STATE, "utf8")) as StubRequest[];
  } catch {
    return [];
  }
}

const NOTE = { name: "note.webm", mimeType: "audio/webm", buffer: Buffer.from("not really audio") };

test("a voice note becomes editable text, not an instant draft", async ({ page }) => {
  const { estimateUrl } = await newDraftEstimate(page, "voice-basic");
  const before = sentToProvider().length;

  await page.locator("#ai_voice_note").setInputFiles(NOTE);
  // The transcript is what the stub was seeded with in ai-stub.mjs style —
  // here transcribe-stub.mjs's own default reply.
  await expect(page.locator("#ai_description")).toHaveValue(
    /Replace the water heater, forty gallon, in the garage\./,
    { timeout: 15_000 },
  );

  expect(sentToProvider().length, "the transcript appeared without calling the provider").toBe(
    before + 1,
  );
  const last = sentToProvider().at(-1);
  expect(last!.language).toBe("en");
  expect(last!.file?.filename).toBe("note.webm");

  // Still just text in a textarea: editable, and nothing was drafted yet.
  // What happens next tests the AI-draft form, not the voice note — state the
  // model's reply explicitly rather than trust whatever an earlier spec file
  // left the shared stub set to.
  await page.request.post(`${AI_STUB_BASE}/__stub/reply`, {
    data: AI_DEFAULT_REPLY,
    headers: { "content-type": "text/plain" },
  });
  await page.locator("#ai_description").fill("Replace the water heater, 40 gallon, garage only.");
  await submitAndSettle(page, page.getByRole("button", { name: /Write a draft/i }));

  await page.goto(estimateUrl);
  await expect(page.locator("#item_description_0")).toHaveValue("Installation, 3 hours");
});

test("a voice note adds to typed text instead of replacing it", async ({ page }) => {
  await newDraftEstimate(page, "voice-append");

  await page.locator("#ai_description").fill("Customer called about a leak.");
  await page.locator("#ai_voice_note").setInputFiles(NOTE);

  await expect(page.locator("#ai_description")).toHaveValue(
    /Customer called about a leak\.[\s\S]*Replace the water heater/,
    { timeout: 15_000 },
  );
});

test("a provider failure leaves the description empty instead of half-filling it", async ({
  page,
}) => {
  await newDraftEstimate(page, "voice-fail");
  await page.request.post(`${STUB_BASE}/__stub/fail-next`);

  await page.locator("#ai_voice_note").setInputFiles(NOTE);

  await expect(
    banner(page, "alert", /voice note didn't come through/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#ai_description")).toHaveValue("");
});

test("an oversized recording is refused locally, before any upload", async ({ page }) => {
  await newDraftEstimate(page, "voice-toobig");
  const before = sentToProvider().length;

  await page.locator("#ai_voice_note").setInputFiles({
    name: "long-note.webm",
    mimeType: "audio/webm",
    buffer: Buffer.alloc(5 * 1024 * 1024),
  });

  await expect(banner(page, "alert", /recording is too long/i)).toBeVisible();
  expect(sentToProvider().length, "an oversized file reached the provider").toBe(before);
  await expect(page.locator("#ai_description")).toHaveValue("");
});

test("a signed-out request for someone else's transcription never runs", async ({
  page,
  browser,
}) => {
  const { estimateUrl } = await newDraftEstimate(page, "voice-auth");
  const transcribeUrl = `${estimateUrl}/transcribe`;

  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  // Same shape as estimate-pdf.spec.ts: this path is under /app/, so
  // middleware.ts redirects to sign-in before the route handler ever runs.
  const response = await stranger.request.post(transcribeUrl, { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["location"] ?? "").toContain("/sign-in");
  await strangerContext.close();
});

test("a released estimate refuses a new voice note, same as the AI draft form", async ({
  page,
}) => {
  const { estimateUrl } = await newDraftEstimate(page, "voice-released");

  await page.locator("#item_description_0").fill("My own line");
  await page.locator("#item_unit_price_0").fill("500");
  await submitAndSettle(
    page,
    formWith(page, "#title").getByRole("button", { name: /Save estimate/i }),
  );
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /^Approve$/ }));
  await page.goto(estimateUrl);
  await submitAndSettle(page, page.getByRole("button", { name: /Mark as sent/i }));

  await page.goto(estimateUrl);
  // The whole "Draft with AI" section — voice note included — is gone once
  // the estimate is a document the customer may already have (§25.3).
  await expect(page.locator("#ai_voice_note")).toHaveCount(0);
});
