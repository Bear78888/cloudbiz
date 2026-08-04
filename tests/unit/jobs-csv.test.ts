import { describe, expect, it } from "vitest";

import {
  buildImportRows,
  csvCell,
  detectMapping,
  isDuplicate,
  markExistingDuplicates,
  normalizeCsvDateTime,
  parseCsv,
  selectRowsToImport,
  toCsv,
  type ColumnMapping,
} from "@/features/jobs/csv";

const TZ = "America/New_York";

describe("CSV parsing (§14.15)", () => {
  it("reads a plain comma file", () => {
    const parsed = parseCsv("Customer,Phone,Job\nJohn Smith,3105550101,Faucet\n");
    expect(parsed.headers).toEqual(["Customer", "Phone", "Job"]);
    expect(parsed.rows).toEqual([["John Smith", "3105550101", "Faucet"]]);
  });

  it("handles the delimiters spreadsheets actually export", () => {
    expect(parseCsv("A;B\n1;2\n").delimiter).toBe(";");
    expect(parseCsv("A\tB\n1\t2\n").delimiter).toBe("\t");
    expect(parseCsv("A;B\n1;2\n").rows).toEqual([["1", "2"]]);
  });

  it("keeps commas, quotes and newlines that live inside a quoted field", () => {
    const parsed = parseCsv('Customer,Notes\n"Smith, John","He said ""call first""\nback door"\n');
    expect(parsed.rows[0][0]).toBe("Smith, John");
    expect(parsed.rows[0][1]).toBe('He said "call first"\nback door');
  });

  it("strips the BOM Excel writes and accepts CRLF", () => {
    const parsed = parseCsv("﻿Customer,Job\r\nJohn,Faucet\r\n");
    expect(parsed.headers).toEqual(["Customer", "Job"]);
    expect(parsed.rows).toEqual([["John", "Faucet"]]);
  });

  it("pads short rows and drops entirely blank ones", () => {
    const parsed = parseCsv("A,B,C\n1,2\n\n,,\n3,4,5\n");
    expect(parsed.rows).toEqual([
      ["1", "2", ""],
      ["3", "4", "5"],
    ]);
  });

  it("returns nothing for an empty file rather than throwing", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("   \n").headers).toEqual([]);
  });
});

describe("column detection", () => {
  it("recognises the usual English headers", () => {
    const mapping = detectMapping(["Customer Name", "Phone", "Email", "Job Total", "Status"]);
    expect(mapping[0]).toBe("customer_name");
    expect(mapping[1]).toBe("customer_phone");
    expect(mapping[2]).toBe("customer_email");
    expect(mapping[3]).toBe("job_total");
    expect(mapping[4]).toBe("status");
  });

  it("recognises Spanish headers and ignores punctuation and case", () => {
    const mapping = detectMapping(["CLIENTE", "Teléfono", "correo", "estado_de_pago"]);
    expect(mapping[0]).toBe("customer_name");
    expect(mapping[1]).toBe("customer_phone");
    expect(mapping[2]).toBe("customer_email");
    expect(mapping[3]).toBe("payment_status");
  });

  it("leaves unknown columns unmapped instead of guessing", () => {
    const mapping = detectMapping(["Customer", "Invoice #", "Internal ref"]);
    expect(mapping[0]).toBe("customer_name");
    expect(mapping[1]).toBe("");
    expect(mapping[2]).toBe("");
  });

  it("never maps two columns to the same field", () => {
    const mapping = detectMapping(["Name", "Customer", "Client"]);
    const used = Object.values(mapping).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("date normalisation", () => {
  it("reads ISO dates with and without a time", () => {
    expect(normalizeCsvDateTime("2026-08-07 14:00")).toBe("2026-08-07T14:00");
    expect(normalizeCsvDateTime("2026-08-07T14:00:00")).toBe("2026-08-07T14:00");
    expect(normalizeCsvDateTime("2026-08-07")).toBe("2026-08-07T00:00");
  });

  it("reads US slash dates, including 12-hour times", () => {
    expect(normalizeCsvDateTime("8/7/2026")).toBe("2026-08-07T00:00");
    expect(normalizeCsvDateTime("8/7/2026 2:00 PM")).toBe("2026-08-07T14:00");
    expect(normalizeCsvDateTime("08/07/26 9:30 AM")).toBe("2026-08-07T09:30");
    expect(normalizeCsvDateTime("8/7/2026 12:00 AM")).toBe("2026-08-07T00:00");
    expect(normalizeCsvDateTime("8/7/2026 12:00 PM")).toBe("2026-08-07T12:00");
  });

  it("returns null for what it cannot read, rather than a wrong date", () => {
    expect(normalizeCsvDateTime("next tuesday")).toBeNull();
    expect(normalizeCsvDateTime("")).toBeNull();
    expect(normalizeCsvDateTime("13/45/2026")).toBeNull();
  });
});

describe("row building and validation", () => {
  const mapping: ColumnMapping = {
    0: "customer_name",
    1: "customer_phone",
    2: "title",
    3: "status",
    4: "job_total",
    5: "scheduled_start",
  };

  it("accepts statuses written as labels, not just codes", () => {
    const built = buildImportRows(
      [
        ["John Smith", "3105550101", "Faucet", "Estimate Sent", "280", ""],
        ["Maria Lopez", "3105550202", "Drain", "estimate_sent", "", ""],
        ["Ana Ruiz", "3105550303", "Heater", "Presupuesto enviado", "", ""],
      ],
      mapping,
      TZ,
    );
    expect(built.errorCount).toBe(0);
    for (const row of built.rows) {
      expect(row.value?.job.status).toBe("estimate_sent");
    }
  });

  it("reports a status it cannot understand on that row only", () => {
    const built = buildImportRows(
      [
        ["John Smith", "", "Faucet", "Invented", "", ""],
        ["Maria Lopez", "", "Drain", "Scheduled", "", ""],
      ],
      mapping,
      TZ,
    );
    expect(built.errorCount).toBe(1);
    expect(built.rows[0].errors.status).toBe("invalid_choice");
    expect(built.rows[0].value).toBeNull();
    expect(built.rows[1].value?.job.status).toBe("scheduled");
  });

  it("parses money and dates the spreadsheet way", () => {
    const built = buildImportRows(
      [["John Smith", "", "Faucet", "", "$1,280.50", "8/7/2026 2:00 PM"]],
      mapping,
      TZ,
    );
    expect(built.rows[0].value?.job.job_total).toBe(1280.5);
    expect(built.rows[0].value?.job.scheduled_start).toBe("2026-08-07T18:00:00.000Z");
  });

  it("falls back to the service column when there is no job title", () => {
    const built = buildImportRows(
      [["John Smith", "", "", "", "", ""]],
      { 0: "customer_name", 2: "service" },
      TZ,
    );
    expect(built.rows[0].value).toBeNull();

    const withService = buildImportRows(
      [["John Smith", "", "Plumbing repair", "", "", ""]],
      { 0: "customer_name", 2: "service" },
      TZ,
    );
    expect(withService.rows[0].value?.job.title).toBe("Plumbing repair");
  });

  it("requires a customer name", () => {
    const built = buildImportRows([["", "", "Faucet", "", "", ""]], mapping, TZ);
    expect(built.rows[0].errors.customer_name).toBe("required");
  });

  it("never imports SMS consent (§17.9)", () => {
    const built = buildImportRows([["John Smith", "3105550101", "Faucet", "", "", ""]], mapping, TZ);
    expect(built.rows[0].value?.customer.sms_consent).toBe(false);
  });
});

describe("duplicate detection (§14.15 step 4)", () => {
  const mapping: ColumnMapping = { 0: "customer_name", 1: "customer_phone", 2: "title" };

  it("spots the same customer twice in one file, whatever the phone format", () => {
    const built = buildImportRows(
      [
        ["John Smith", "(310) 555-0101", "Faucet"],
        ["Maria Lopez", "3105550202", "Drain"],
        ["J. Smith", "+1 310 555 0101", "Water heater"],
      ],
      mapping,
      TZ,
    );
    expect(built.rows[0].duplicateOfLine).toBeNull();
    expect(built.rows[1].duplicateOfLine).toBeNull();
    expect(built.rows[2].duplicateOfLine).toBe(1);
    expect(built.duplicateCount).toBe(1);
  });

  it("flags customers the tracker already has", () => {
    const built = buildImportRows(
      [
        ["John Smith", "3105550101", "Faucet"],
        ["New Person", "3105559999", "Drain"],
      ],
      mapping,
      TZ,
    );
    const marked = markExistingDuplicates(built.rows, ["phone:3105550101"]);
    expect(marked.rows[0].duplicateOfExisting).toBe(true);
    expect(marked.rows[1].duplicateOfExisting).toBe(false);
    expect(marked.duplicateCount).toBe(1);
  });

  it("imports duplicates only when the owner asks for them", () => {
    const built = buildImportRows(
      [
        ["John Smith", "3105550101", "Faucet"],
        ["John Smith", "3105550101", "Second visit"],
      ],
      mapping,
      TZ,
    );
    expect(selectRowsToImport(built.rows, true)).toHaveLength(1);
    expect(selectRowsToImport(built.rows, false)).toHaveLength(2);
  });

  it("leaves invalid rows out either way", () => {
    const built = buildImportRows(
      [
        ["", "3105550101", "No name"],
        ["Maria Lopez", "3105550202", "Drain"],
      ],
      mapping,
      TZ,
    );
    expect(selectRowsToImport(built.rows, false)).toHaveLength(1);
    expect(isDuplicate(built.rows[1])).toBe(false);
  });
});

describe("CSV export (§13.8)", () => {
  it("quotes the characters that would otherwise break a row", () => {
    expect(csvCell("Smith, John")).toBe('"Smith, John"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
  });

  it("defuses cells a spreadsheet would run as a formula", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@import")).toBe("'@import");
    // A real number still exports as a number.
    expect(csvCell(280.5)).toBe("280.5");
  });

  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv(["A", "B"], [["1", "2"]]);
    expect(csv).toBe("A,B\r\n1,2\r\n");
  });

  it("round-trips through the parser", () => {
    const csv = toCsv(["Customer", "Notes"], [["Smith, John", 'said "yes"']]);
    const parsed = parseCsv(csv);
    expect(parsed.rows[0]).toEqual(["Smith, John", 'said "yes"']);
  });
});
