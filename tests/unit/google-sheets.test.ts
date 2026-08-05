import { describe, expect, it, vi } from "vitest";

import { createSpreadsheet, spreadsheetUrl, tabRange } from "@/features/google/sheets";
import { TABS } from "@/features/google/sheet-schema";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CREATED = {
  spreadsheetId: "sheet-abc",
  properties: { title: "HandyAlliance — Sunrise Plumbing" },
  sheets: [
    { properties: { sheetId: 0, title: "Jobs" } },
    { properties: { sheetId: 1, title: "Customers" } },
    { properties: { sheetId: 2, title: "Read Me" } },
  ],
};

const input = {
  accessToken: "ya29.token",
  businessName: "Sunrise Plumbing",
  locale: "en" as const,
  dashboardUrl: "https://handyalliance.com/en/app",
};

describe("creating the spreadsheet", () => {
  it("builds the whole structure in one request", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(CREATED));
    const result = await createSpreadsheet({ ...input, fetchImpl });

    // One call, not create-then-add-tabs: a failure halfway through would
    // leave a half-built spreadsheet in the user's Drive.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      value: {
        spreadsheetId: "sheet-abc",
        spreadsheetName: "HandyAlliance — Sunrise Plumbing",
        // §14.8: tabs are addressed by numeric id, so a rename cannot break sync.
        tabMapping: { Jobs: 0, Customers: 1, "Read Me": 2 },
      },
    });
  });

  it("sends every tab with its header row and the §14.6 title", async () => {
    let sent: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return jsonResponse(CREATED);
    });
    await createSpreadsheet({ ...input, fetchImpl });

    expect((sent.properties as { title: string }).title).toBe(
      "HandyAlliance — Sunrise Plumbing",
    );
    const sheets = sent.sheets as { properties: { title: string }; data: unknown[] }[];
    expect(sheets).toHaveLength(TABS.length);
    expect(sheets.map((s) => s.properties.title)).toEqual(["Jobs", "Customers", "Read Me"]);
    expect(sheets.every((s) => s.data.length > 0)).toBe(true);
  });

  it("uses Spanish tab titles and headers for a Spanish organization", async () => {
    let sent: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return jsonResponse(CREATED);
    });
    await createSpreadsheet({ ...input, locale: "es", fetchImpl });

    const sheets = sent.sheets as { properties: { title: string } }[];
    expect(sheets.map((s) => s.properties.title)).toEqual(["Trabajos", "Clientes", "Léeme"]);
  });

  it("authorises with the access token", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer ya29.token");
      return jsonResponse(CREATED);
    });
    await createSpreadsheet({ ...input, fetchImpl });
    expect(fetchImpl).toHaveBeenCalled();
  });

  // Each of these calls for a different response, so they must not collapse
  // into one generic error: reconnect vs. retry vs. give up (§14.11, §14.14).
  it("distinguishes the failures that need different reactions", async () => {
    const attempt = (status: number) =>
      createSpreadsheet({ ...input, fetchImpl: async () => jsonResponse({}, status) });

    expect(await attempt(401)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await attempt(403)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await attempt(404)).toEqual({ ok: false, reason: "not_found" });
    expect(await attempt(429)).toEqual({ ok: false, reason: "rate_limited" });
    expect(await attempt(503)).toEqual({ ok: false, reason: "rate_limited" });
    expect(await attempt(400)).toEqual({ ok: false, reason: "failed" });
  });

  it("treats a network failure as retryable, not as the user's problem", async () => {
    const result = await createSpreadsheet({
      ...input,
      fetchImpl: async () => {
        throw new Error("ECONNRESET");
      },
    });
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("refuses a response without a spreadsheet id rather than inventing one", async () => {
    const result = await createSpreadsheet({
      ...input,
      fetchImpl: async () => jsonResponse({ properties: { title: "x" } }),
    });
    expect(result).toEqual({ ok: false, reason: "failed" });
  });
});

describe("ranges and links", () => {
  it("quotes tab titles so spaces and apostrophes survive", () => {
    expect(tabRange("Read Me")).toBe("'Read Me'");
    expect(tabRange("Bob's Jobs")).toBe("'Bob''s Jobs'");
  });

  it("links to the spreadsheet and to a specific tab", () => {
    expect(spreadsheetUrl("abc")).toBe("https://docs.google.com/spreadsheets/d/abc/edit");
    expect(spreadsheetUrl("abc", 2)).toBe(
      "https://docs.google.com/spreadsheets/d/abc/edit#gid=2",
    );
  });
});
