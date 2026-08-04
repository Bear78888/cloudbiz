import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/en";
import { parseJobForm, type RawForm } from "@/features/jobs/schema";
import { isoToZonedInput, zonedInputToIso } from "@/lib/datetime";

const TZ = "America/New_York";

function form(overrides: RawForm = {}): RawForm {
  return { customer_name: "John Smith", title: "Faucet replacement", ...overrides };
}

describe("job form validation (§13.5)", () => {
  it("accepts the minimum a job needs: a customer and a title", () => {
    const result = parseJobForm(form(), TZ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.customer.name).toBe("John Smith");
    expect(result.value.job.title).toBe("Faucet replacement");
    expect(result.value.job.status).toBe("new_lead");
    expect(result.value.job.priority).toBe("normal");
    expect(result.value.job.payment_status).toBe("unpaid");
    expect(result.value.customer.sms_consent).toBe(false);
  });

  it("requires a customer name and a title", () => {
    const result = parseJobForm({ customer_name: "   ", title: "" }, TZ);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.customer_name).toBe("required");
    expect(result.errors.title).toBe("required");
  });

  it("reports every bad field at once, not just the first", () => {
    const result = parseJobForm(
      form({ customer_email: "not-an-email", job_total: "abc", status: "invented" }),
      TZ,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.customer_email).toBe("invalid_email");
    expect(result.errors.job_total).toBe("invalid_amount");
    expect(result.errors.status).toBe("invalid_choice");
  });

  it("every error code has a message in the dictionary (§29)", () => {
    const result = parseJobForm(
      form({ customer_email: "x", job_total: "abc", scheduled_start: "not-a-date" }),
      TZ,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const code of Object.values(result.errors)) {
      expect(en.platform.jobs.fieldErrors[code]).toBeTruthy();
    }
  });

  it("rejects codes that are not in a registry rather than storing them", () => {
    for (const field of ["status", "priority", "payment_status", "source", "customer_locale"]) {
      const result = parseJobForm(form({ [field]: "'; drop table jobs; --" }), TZ);
      expect(result.ok, `${field} accepted an unknown value`).toBe(false);
    }
  });

  it("treats blank money fields as unknown, not zero", () => {
    const result = parseJobForm(form({ estimate_amount: "", job_total: "  " }), TZ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.job.estimate_amount).toBeNull();
    expect(result.value.job.job_total).toBeNull();
  });

  it("records SMS consent only on an explicit opt-in (§17.9)", () => {
    const off = parseJobForm(form(), TZ);
    expect(off.ok && off.value.customer.sms_consent).toBe(false);
    const on = parseJobForm(form({ sms_consent: "on" }), TZ);
    expect(on.ok && on.value.customer.sms_consent).toBe(true);
  });

  it("refuses a schedule that ends before it starts", () => {
    const result = parseJobForm(
      form({ scheduled_start: "2026-08-07T14:00", scheduled_end: "2026-08-07T13:00" }),
      TZ,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.scheduled_end).toBe("schedule_order");
  });

  it("stores the schedule as an instant read in the organization's time zone", () => {
    const result = parseJobForm(form({ scheduled_start: "2026-08-07T14:00" }), TZ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 PM in New York during DST is 18:00 UTC.
    expect(result.value.job.scheduled_start).toBe("2026-08-07T18:00:00.000Z");
  });
});

describe("time zone conversion", () => {
  it("round-trips a wall-clock time through storage and back", () => {
    const iso = zonedInputToIso("2026-08-07T14:00", TZ);
    expect(iso).not.toBeNull();
    expect(isoToZonedInput(iso, TZ)).toBe("2026-08-07T14:00");
  });

  it("applies the offset actually in force, on both sides of a DST change", () => {
    // EDT (UTC-4) in August, EST (UTC-5) in January.
    expect(zonedInputToIso("2026-08-07T14:00", TZ)).toBe("2026-08-07T18:00:00.000Z");
    expect(zonedInputToIso("2026-01-07T14:00", TZ)).toBe("2026-01-07T19:00:00.000Z");
  });

  it("handles a zone that does not observe DST", () => {
    expect(zonedInputToIso("2026-08-07T14:00", "America/Phoenix")).toBe("2026-08-07T21:00:00.000Z");
    expect(zonedInputToIso("2026-01-07T14:00", "America/Phoenix")).toBe("2026-01-07T21:00:00.000Z");
  });

  it("handles midnight without rolling the date", () => {
    const iso = zonedInputToIso("2026-08-07T00:00", TZ);
    expect(isoToZonedInput(iso, TZ)).toBe("2026-08-07T00:00");
  });

  it("returns null for blank or malformed input instead of an invalid date", () => {
    expect(zonedInputToIso("", TZ)).toBeNull();
    expect(zonedInputToIso(null, TZ)).toBeNull();
    expect(zonedInputToIso("07/08/2026", TZ)).toBeNull();
    expect(isoToZonedInput(null, TZ)).toBe("");
    expect(isoToZonedInput("not-a-date", TZ)).toBe("");
  });
});
