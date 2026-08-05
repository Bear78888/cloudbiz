import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { createJob, createOrganization, signUp, uniqueEmail } from "./helpers";

/**
 * The invariant nobody was checking: **every event marked `synced` corresponds
 * to a row the sheet actually accepted.**
 *
 * A job once reached `synced` with nothing written — a query asked for a column
 * that does not exist, the error was discarded, no rows were built, and the
 * queue reported success. Every test was green, because each one checked a
 * separate half: the events said "synced", and nothing compared that to what
 * the spreadsheet received.
 *
 * The Sheets and OAuth endpoints are a local stub (`sheets-stub.mjs`). That is
 * on purpose: the defect was in our bookkeeping, not in Google, and a stub is
 * the only way to count what arrived.
 */

const STATE_PATH = process.env.SHEETS_STUB_STATE ?? "/tmp/sheets-stub.json";
const ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Same envelope as `src/features/google/crypto.ts`, written out rather than
 * imported: that module is `server-only` and refuses to load here.
 */
function encryptToken(plaintext: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyMaterial, "base64"), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(":");
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function stubState(): Record<string, Record<string, string[][]>> {
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

test.describe.configure({ mode: "serial" });

test("every event reported as synced has a row in the sheet", async ({ page }) => {
  test.skip(!ENCRYPTION_KEY || !CRON_SECRET, "sync stub environment is not configured");

  await signUp(page, uniqueEmail("e2e-sync"));
  await createOrganization(page, "E2E Sync Plumbing");
  await createJob(page, {
    customer: "Sheet Check Customer",
    phone: "(310) 555-0188",
    title: "Sheet check job",
    jobTotal: "420",
  });

  const supabase = admin();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "E2E Sync Plumbing")
    .single();
  const organizationId = organization!.id as string;

  // Connect Google without going through the consent screen: the OAuth leg is
  // covered elsewhere and cannot run headless anyway (the consent screen only
  // admits listed test users). What is under test here is the sync.
  const { data: connection } = await supabase
    .from("google_connections")
    .insert({
      organization_id: organizationId,
      google_subject: "stub-subject",
      email: "stub@example.com",
      scopes: ["https://www.googleapis.com/auth/drive.file"],
      status: "active",
    })
    .select("id")
    .single();

  await supabase.from("google_oauth_tokens").insert({
    connection_id: connection!.id as string,
    organization_id: organizationId,
    encrypted_refresh_token: encryptToken("stub-refresh-token", ENCRYPTION_KEY!),
    key_version: 1,
  });

  // Create the spreadsheet in the stub first and use the id it hands back.
  // Hardcoding one would make a retry write into the previous attempt's sheet,
  // and the count below would fail for a reason that has nothing to do with
  // the invariant.
  const header = (title: string, first: string) => ({
    properties: { title },
    data: [{ rowData: [{ values: [{ userEnteredValue: { stringValue: first } }] }] }],
  });
  const createdResponse = await fetch(`${process.env.GOOGLE_SHEETS_API_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: "HandyAlliance — E2E Sync Plumbing" },
      sheets: [
        header("Jobs", "HandyAlliance Job ID"),
        header("Customers", "Customer ID"),
        { properties: { title: "Read Me" }, data: [{ rowData: [] }] },
      ],
    }),
  });
  const created = (await createdResponse.json()) as { spreadsheetId: string };

  await supabase.from("google_spreadsheets").insert({
    organization_id: organizationId,
    connection_id: connection!.id as string,
    spreadsheet_id: created.spreadsheetId,
    spreadsheet_name: "HandyAlliance — E2E Sync Plumbing",
    tab_mapping: { Jobs: 0, Customers: 1, "Read Me": 2 },
    status: "active",
  });

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/google-sync`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.status).toBe(200);

  const { data: events } = await supabase
    .from("sync_outbox")
    .select("entity_type, entity_id, status")
    .eq("organization_id", organizationId);

  const synced = (events ?? []).filter((event) => event.status === "synced");
  // The run has to have done something; an empty queue would make the
  // comparison below pass for the wrong reason.
  expect(synced.length).toBeGreaterThan(0);

  const state = stubState();
  const tabs = state[created.spreadsheetId] ?? {};
  const idsInSheet = new Set(
    [...(tabs.Jobs ?? []).slice(1), ...(tabs.Customers ?? []).slice(1)].map((row) => row[0]),
  );

  // The invariant itself.
  for (const event of synced) {
    expect(
      idsInSheet.has(event.entity_id as string),
      `event for ${event.entity_type} ${event.entity_id} says synced, but no row reached the sheet`,
    ).toBe(true);
  }
  expect(idsInSheet.size).toBe(synced.length);

  // And a field with an outside dependency, because "a row arrived" does not
  // mean "the row is right". The link used to come from a hardcoded domain and
  // pointed at a site that was not live — a plausible dead URL that no count
  // would have caught.
  const jobRow = (tabs.Jobs ?? []).slice(1)[0];
  expect(jobRow).toBeDefined();
  const link = jobRow[22];
  expect(link).toContain(process.env.NEXT_PUBLIC_APP_URL!);
  expect(link).not.toContain("handyalliance.com");
});
