#!/usr/bin/env node
/**
 * A stand-in for the Google Sheets and OAuth token endpoints, used by the
 * end-to-end run.
 *
 * It exists to make one assertion possible: **the number of events marked
 * `synced` equals the number of rows the sheet actually accepted.** Nobody was
 * comparing those two numbers, which is exactly how a job that never reached
 * the spreadsheet was reported as synced while every test stayed green.
 *
 * It deliberately imitates Google's shapes only as far as the worker uses them.
 * This is not a Google simulator and must not grow into one — it checks *our*
 * bookkeeping, which is where the defect was, not Google's behaviour.
 *
 * State is written to `$SHEETS_STUB_STATE` so the spec can read what arrived.
 */

import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.SHEETS_STUB_PORT ?? 4545);
const STATE_PATH = process.env.SHEETS_STUB_STATE ?? "/tmp/sheets-stub.json";

/** spreadsheetId → tab title → array of rows (each row an array of cells). */
const sheets = new Map();

function persist() {
  const dump = {};
  for (const [id, tabs] of sheets) {
    dump[id] = Object.fromEntries([...tabs].map(([title, rows]) => [title, rows]));
  }
  writeFileSync(STATE_PATH, JSON.stringify(dump, null, 2));
}

function tabsFor(spreadsheetId) {
  if (!sheets.has(spreadsheetId)) sheets.set(spreadsheetId, new Map());
  return sheets.get(spreadsheetId);
}

/** `'Jobs'!A2:A` → `Jobs`. */
function tabFromRange(range) {
  const decoded = decodeURIComponent(range);
  const match = decoded.match(/^'((?:[^']|'')*)'/);
  if (match) return match[1].replace(/''/g, "'");
  return decoded.split("!")[0];
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  // OAuth token endpoint. The worker only needs an access token back; the
  // refresh token it sends was encrypted by the app with the test key, so a
  // round trip through real Google would prove nothing extra here.
  if (path === "/token") {
    return json(response, 200, { access_token: "stub-access-token", expires_in: 3600 });
  }

  // Create a spreadsheet.
  if (path === "/v4/spreadsheets" && request.method === "POST") {
    const body = await readBody(request);
    const spreadsheetId = `stub-sheet-${sheets.size + 1}`;
    const tabs = tabsFor(spreadsheetId);
    const created = (body.sheets ?? []).map((sheet, index) => {
      const title = sheet.properties?.title ?? `Sheet${index}`;
      const rows = (sheet.data?.[0]?.rowData ?? []).map((row) =>
        (row.values ?? []).map((cell) => cell.userEnteredValue?.stringValue ?? ""),
      );
      tabs.set(title, rows);
      return { properties: { sheetId: index, title } };
    });
    persist();
    return json(response, 200, {
      spreadsheetId,
      properties: { title: body.properties?.title ?? "" },
      sheets: created,
    });
  }

  const spreadsheetMatch = path.match(/^\/v4\/spreadsheets\/([^/]+)/);
  if (!spreadsheetMatch) return json(response, 404, { error: "not found" });
  const spreadsheetId = decodeURIComponent(spreadsheetMatch[1]);
  const tabs = tabsFor(spreadsheetId);

  // Read the id column.
  const valuesGet = path.match(/^\/v4\/spreadsheets\/[^/]+\/values\/([^/:]+)$/);
  if (valuesGet && request.method === "GET") {
    const title = tabFromRange(valuesGet[1]);
    const rows = tabs.get(title) ?? [];
    // The worker asks for A2:A — everything below the header.
    return json(response, 200, { values: rows.slice(1).map((row) => [row[0] ?? ""]) });
  }

  // Rewrite a range (Read Me).
  if (valuesGet && request.method === "PUT") {
    const title = tabFromRange(valuesGet[1]);
    const body = await readBody(request);
    tabs.set(title, body.values ?? []);
    persist();
    return json(response, 200, { updatedRows: (body.values ?? []).length });
  }

  // Update existing rows in place.
  if (path.endsWith("/values:batchUpdate") && request.method === "POST") {
    const body = await readBody(request);
    for (const entry of body.data ?? []) {
      const title = tabFromRange(entry.range);
      const rowNumber = Number((entry.range.match(/!A(\d+)/) ?? [])[1]);
      const rows = tabs.get(title) ?? [];
      if (Number.isFinite(rowNumber)) rows[rowNumber - 1] = entry.values?.[0] ?? [];
      tabs.set(title, rows);
    }
    persist();
    return json(response, 200, { totalUpdatedRows: (body.data ?? []).length });
  }

  // Append new rows.
  const append = path.match(/^\/v4\/spreadsheets\/[^/]+\/values\/([^/:]+):append$/);
  if (append && request.method === "POST") {
    const title = tabFromRange(append[1]);
    const body = await readBody(request);
    const rows = tabs.get(title) ?? [];
    for (const row of body.values ?? []) rows.push(row);
    tabs.set(title, rows);
    persist();
    return json(response, 200, { updates: { updatedRows: (body.values ?? []).length } });
  }

  return json(response, 404, { error: "unhandled", path, method: request.method });
});

server.listen(PORT, "127.0.0.1", () => {
  persist();
  console.log(`sheets stub listening on http://127.0.0.1:${PORT}, state -> ${STATE_PATH}`);
});
