import "server-only";

import { TABS, headerRow, readMeRows, spreadsheetTitle, type TabKey } from "./sheet-schema";

/**
 * Google Sheets API calls (§14.4 step 3, §14.7).
 *
 * `fetch` is injected so the shapes that matter — a quota refusal, a sheet the
 * user deleted, a malformed response — are testable without a Google account.
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export type SheetsFailure =
  | "unauthorized" // token rejected: reconnect
  | "not_found" // the spreadsheet is gone (§14.14)
  | "rate_limited" // back off and retry (§14.11)
  | "failed";

export interface CreatedSpreadsheet {
  spreadsheetId: string;
  spreadsheetName: string;
  /** Tab title → numeric sheetId. §14.8: address tabs by id, not by name. */
  tabMapping: Record<string, number>;
}

export type SheetsResult<T> = { ok: true; value: T } | { ok: false; reason: SheetsFailure };

/** Maps an HTTP status onto the decision the caller has to make. */
function failureFor(status: number): SheetsFailure {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  // 429 and 5xx are both "try again later" (§14.11), not "tell the user".
  if (status === 429 || status >= 500) return "rate_limited";
  return "failed";
}

export interface CreateSpreadsheetInput {
  accessToken: string;
  businessName: string;
  locale: "en" | "es";
  dashboardUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * Creates the spreadsheet with its tabs and headers in one call.
 *
 * One request rather than create-then-add-tabs-then-write-headers: a failure
 * halfway through the second approach leaves a half-built spreadsheet in the
 * user's Drive that our code does not recognise and they did not ask for.
 * Sheets accepts the whole structure at once, so the operation either produces
 * a complete sheet or nothing.
 */
export async function createSpreadsheet({
  accessToken,
  businessName,
  locale,
  dashboardUrl,
  fetchImpl = fetch,
}: CreateSpreadsheetInput): Promise<SheetsResult<CreatedSpreadsheet>> {
  const title = spreadsheetTitle(businessName);

  const sheets = TABS.map((tab, index) => {
    const rows =
      tab.key === "readme"
        ? readMeRows({ locale, dashboardUrl, lastSyncedAt: null })
        : [headerRow(tab.key, locale)];

    return {
      properties: {
        sheetId: index,
        title: tab.title[locale],
        index,
        // The header row stays visible while the owner scrolls; on a sheet
        // with two dozen columns that is the difference between readable and
        // not. Read Me has no header to freeze.
        gridProperties: tab.key === "readme" ? {} : { frozenRowCount: 1 },
      },
      data: [
        {
          startRow: 0,
          startColumn: 0,
          rowData: rows.map((row) => ({
            values: row.map((cell) => ({ userEnteredValue: { stringValue: cell } })),
          })),
        },
      ],
    };
  });

  let response: Response;
  try {
    response = await fetchImpl(SHEETS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { title, locale }, sheets }),
    });
  } catch {
    return { ok: false, reason: "rate_limited" }; // network blip: retryable
  }

  if (!response.ok) return { ok: false, reason: failureFor(response.status) };

  try {
    const body = (await response.json()) as {
      spreadsheetId?: string;
      properties?: { title?: string };
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };
    if (!body.spreadsheetId) return { ok: false, reason: "failed" };

    const tabMapping: Record<string, number> = {};
    for (const sheet of body.sheets ?? []) {
      const sheetTitle = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (sheetTitle && typeof sheetId === "number") tabMapping[sheetTitle] = sheetId;
    }

    return {
      ok: true,
      value: {
        spreadsheetId: body.spreadsheetId,
        spreadsheetName: body.properties?.title ?? title,
        tabMapping,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Reads a spreadsheet's title and tabs — used to attach one chosen via the Picker. */
export async function describeSpreadsheet({
  accessToken,
  spreadsheetId,
  fetchImpl = fetch,
}: {
  accessToken: string;
  spreadsheetId: string;
  fetchImpl?: typeof fetch;
}): Promise<SheetsResult<{ spreadsheetName: string; tabMapping: Record<string, number> }>> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    return { ok: false, reason: "rate_limited" };
  }

  if (!response.ok) return { ok: false, reason: failureFor(response.status) };

  try {
    const body = (await response.json()) as {
      properties?: { title?: string };
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };
    const tabMapping: Record<string, number> = {};
    for (const sheet of body.sheets ?? []) {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (title && typeof sheetId === "number") tabMapping[title] = sheetId;
    }
    return {
      ok: true,
      value: { spreadsheetName: body.properties?.title ?? "", tabMapping },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** A1 range for a whole tab, quoting the title so spaces and apostrophes survive. */
export function tabRange(tabTitle: string): string {
  return `'${tabTitle.replace(/'/g, "''")}'`;
}

export function spreadsheetUrl(spreadsheetId: string, tabId?: number): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return tabId === undefined ? base : `${base}#gid=${tabId}`;
}

export type { TabKey };
