import { describe, expect, it } from "vitest";

import { customerToRow, jobToRow, sheetCell, type JobRowInput, type RowContext } from "@/features/google/rows";
import { TABS, headerRow, readMeRows, spreadsheetTitle } from "@/features/google/sheet-schema";

const context: RowContext = {
  timeZone: "America/New_York",
  locale: "en",
  appUrl: "https://handyalliance.com",
  statusLabels: { new_lead: "New Lead", scheduled: "Scheduled" },
  paymentStatusLabels: { unpaid: "Unpaid", paid: "Paid" },
  priorityLabels: { normal: "Normal", urgent: "Urgent" },
  leadSourceLabels: { referral: "Referral" },
};

const job: JobRowInput = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "scheduled",
  createdAt: "2026-08-04T18:30:00Z",
  updatedAt: "2026-08-04T18:35:00Z",
  customerName: "John Smith",
  customerPhone: "(310) 555-0101",
  customerEmail: "john@example.com",
  customerLocale: "en",
  service: "Plumbing",
  title: "Faucet replacement",
  description: "Kitchen sink",
  leadSource: "referral",
  priority: "normal",
  address: "12 Oak St",
  scheduledStart: "2026-08-07T18:00:00Z", // 2 PM in New York
  estimateAmount: "280",
  jobTotal: 340,
  materialsCost: null,
  paymentStatus: "unpaid",
  assignedTo: "Maria",
  lastFollowUpAt: null,
  reviewRequestedAt: null,
  notes: null,
  deletedAt: null,
};

describe("job rows", () => {
  it("puts the UUID first and matches the Jobs header width", () => {
    const row = jobToRow(job, context);
    // §14.8: rows are identified by UUID, never by customer name.
    expect(row[0]).toBe(job.id);
    expect(row).toHaveLength(headerRow("jobs", "en").length);
  });

  // §25.1: the sheet shows the organization's wall clock, not the server's.
  it("writes the scheduled time in the organization's time zone", () => {
    expect(jobToRow(job, context)[13]).toBe("2026-08-07 14:00");
    expect(jobToRow(job, { ...context, timeZone: "America/Los_Angeles" })[13]).toBe(
      "2026-08-07 11:00",
    );
  });

  // §14.2: the sheet is a source for Make/Zapier. A localized display string
  // would sort wrongly and parse badly.
  it("uses a sortable, locale-independent stamp", () => {
    const en = jobToRow(job, context)[2];
    const es = jobToRow(job, { ...context, locale: "es" })[2];
    expect(en).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(es).toBe(en);
  });

  it("shows labels rather than internal codes", () => {
    const row = jobToRow(job, context);
    expect(row[1]).toBe("Scheduled");
    expect(row[11]).toBe("Normal");
    expect(row[17]).toBe("Unpaid");
    // An unknown code falls back to itself rather than to an empty cell:
    // a visible oddity beats a silently blank column.
    expect(jobToRow({ ...job, status: "brand_new" }, context)[1]).toBe("brand_new");
  });

  // §14.12: the row stays and is marked, it does not disappear.
  it("marks a soft-deleted job instead of dropping the row", () => {
    const deleted = jobToRow({ ...job, deletedAt: "2026-08-05T10:00:00Z" }, context);
    expect(deleted[23]).toBe("TRUE");
    expect(deleted[0]).toBe(job.id);
    expect(jobToRow(job, context)[23]).toBe("FALSE");
  });

  it("writes money as a plain decimal and blanks what is missing", () => {
    const row = jobToRow(job, context);
    expect(row[14]).toBe("280.00");
    expect(row[15]).toBe("340.00");
    expect(row[16]).toBe("");
    expect(jobToRow({ ...job, jobTotal: "not a number" }, context)[15]).toBe("");
  });

  it("links back to the job in HandyAlliance", () => {
    expect(jobToRow(job, context)[22]).toBe(
      `https://handyalliance.com/en/app/jobs/${job.id}`,
    );
    expect(jobToRow(job, { ...context, locale: "es" })[22]).toContain("/es/app/jobs/");
  });

  it("survives a job with nothing filled in but the required fields", () => {
    const bare = jobToRow(
      {
        ...job,
        customerName: null,
        customerPhone: null,
        customerEmail: null,
        customerLocale: null,
        service: null,
        description: null,
        leadSource: null,
        address: null,
        scheduledStart: null,
        estimateAmount: null,
        jobTotal: null,
        assignedTo: null,
      },
      context,
    );
    expect(bare).toHaveLength(headerRow("jobs", "en").length);
    expect(bare[8]).toBe("Faucet replacement"); // falls back to the title
    expect(bare.every((cell) => typeof cell === "string")).toBe(true);
  });
});

describe("formula defusing", () => {
  // Sheets executes a leading =, +, - or @. A customer called "=Smith" must
  // not become a formula — the same defusing as the CSV export (§14.15).
  it("neutralises values that would be read as formulas", () => {
    expect(sheetCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(sheetCell("+1")).toBe("'+1");
    expect(sheetCell("-5")).toBe("'-5");
    expect(sheetCell("@handle")).toBe("'@handle");
    expect(sheetCell("John Smith")).toBe("John Smith");
    expect(sheetCell(null)).toBe("");
  });

  it("defuses values coming through a job row", () => {
    expect(jobToRow({ ...job, customerName: "=cmd()" }, context)[4]).toBe("'=cmd()");
    expect(jobToRow({ ...job, notes: "-note" }, context)[21]).toBe("'-note");
  });
});

describe("customer rows", () => {
  it("matches the Customers header width and leads with the id", () => {
    const row = customerToRow(
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Maria Lopez",
        phone: "3105550144",
        email: null,
        preferredLocale: "es",
        address: null,
        leadSource: "referral",
        firstJobDate: "2026-01-05T12:00:00Z",
        lastJobDate: "2026-08-04T12:00:00Z",
        totalJobs: null,
        totalRevenue: "1250.5",
        notes: null,
        updatedAt: "2026-08-04T18:35:00Z",
      },
      context,
    );
    expect(row[0]).toBe("22222222-2222-2222-2222-222222222222");
    expect(row).toHaveLength(headerRow("customers", "en").length);
    expect(row[9]).toBe("");
    expect(row[10]).toBe("1250.50");
    expect(row[7]).toBe("2026-01-05");
  });
});

describe("sheet schema", () => {
  it("names the spreadsheet per §14.6", () => {
    expect(spreadsheetTitle("Sunrise Plumbing")).toBe("HandyAlliance — Sunrise Plumbing");
  });

  it("keeps English and Spanish headers the same width", () => {
    for (const tab of TABS) {
      expect(headerRow(tab.key, "en")).toHaveLength(headerRow(tab.key, "es").length);
      // A blank header would produce a column nobody can reference.
      if (tab.key !== "readme") {
        expect(headerRow(tab.key, "en").every((h) => h.length > 0)).toBe(true);
        expect(headerRow(tab.key, "es").every((h) => h.length > 0)).toBe(true);
      }
    }
  });

  // §14.3: the warning belongs inside the sheet, because that is where the
  // person who is about to edit it actually is.
  it("carries the do-not-edit warning and the schema version in Read Me", () => {
    const en = readMeRows({ locale: "en", dashboardUrl: "https://handyalliance.com/en/app", lastSyncedAt: null })
      .flat()
      .join("\n");
    expect(en).toContain("Edit jobs in HandyAlliance. This sheet updates automatically.");
    expect(en).toContain("Not yet");

    const es = readMeRows({ locale: "es", dashboardUrl: "https://handyalliance.com/es/app", lastSyncedAt: null })
      .flat()
      .join("\n");
    expect(es).toContain("Edita los trabajos en HandyAlliance. Esta hoja se actualiza automáticamente.");
  });
});

describe("columns with no source behind them", () => {
  // The rule, learned the hard way: a customer with one job showed "Total
  // Jobs: 0" because the aggregate did not exist yet. Zero reads as a fact.
  // An empty cell reads as "not known", which is the truth.
  it("leaves an aggregate blank rather than writing zero", () => {
    const base = {
      id: "c1",
      name: "Ana",
      phone: null,
      email: null,
      preferredLocale: null,
      address: null,
      leadSource: null,
      firstJobDate: null,
      lastJobDate: null,
      totalJobs: null,
      totalRevenue: null,
      notes: null,
      updatedAt: "2026-08-04T18:35:00Z",
    };
    expect(customerToRow(base, context)[9]).toBe("");
    expect(customerToRow({ ...base, totalJobs: 4 }, context)[9]).toBe("4");
  });

  // The link used to fall back to a hardcoded domain and wrote a dead URL into
  // a real customer's sheet. A plausible wrong value is worse than none.
  it("omits the link when the deployment address is unknown", () => {
    expect(jobToRow(job, { ...context, appUrl: null })[22]).toBe("");
    expect(jobToRow(job, { ...context, appUrl: "https://preview.example" })[22]).toBe(
      `https://preview.example/en/app/jobs/${job.id}`,
    );
  });
});
