import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/en";
import { ESTIMATE_STATUSES, jobStatusForEstimate } from "@/features/estimates/model";
import {
  CLOSED_STATUSES,
  CUSTOMER_LOCALES,
  JOB_PRIORITIES,
  JOB_STATUSES,
  JOB_STATUS_FACTS,
  JOB_VIEWS,
  LEAD_SOURCES,
  PAYMENT_STATUSES,
  customerMatchKey,
  derivePaymentStatus,
  isClosed,
  isEstimateOwnedStatus,
  isJobStatus,
  jobMargin,
  matchesView,
  normalizePhone,
  parseMoney,
  parseSort,
  parseView,
  sortSpec,
  viewFilter,
  type JobStatus,
  type JobView,
  type PaymentStatus,
} from "@/features/jobs/model";

/**
 * The registries in the model are the single source of truth shared by the
 * migration's CHECK constraints and the dictionaries. These tests pin all
 * three together.
 */

describe("job status registry (§13.6)", () => {
  it("carries exactly the eleven specified codes, in spec order", () => {
    expect(JOB_STATUSES).toEqual([
      "new_lead",
      "contacted",
      "estimate_draft",
      "estimate_sent",
      "estimate_accepted",
      "scheduled",
      "in_progress",
      "completed",
      "paid",
      "lost",
      "canceled",
    ]);
  });

  it("every code has an English label (Spanish parity is covered separately)", () => {
    for (const status of JOB_STATUSES) {
      expect(en.platform.jobs.statuses[status]).toBeTruthy();
    }
    for (const view of JOB_VIEWS) {
      expect(en.platform.jobs.views[view]).toBeTruthy();
    }
    for (const priority of JOB_PRIORITIES) {
      expect(en.platform.jobs.priorities[priority]).toBeTruthy();
    }
    for (const payment of PAYMENT_STATUSES) {
      expect(en.platform.jobs.paymentStatuses[payment]).toBeTruthy();
    }
    for (const source of LEAD_SOURCES) {
      expect(en.platform.jobs.leadSources[source]).toBeTruthy();
    }
  });

  it("has no label without a code (dead dictionary entries)", () => {
    expect(Object.keys(en.platform.jobs.statuses).sort()).toEqual([...JOB_STATUSES].sort());
    expect(Object.keys(en.platform.jobs.views).sort()).toEqual([...JOB_VIEWS].sort());
  });

  it("treats settled and abandoned work as closed", () => {
    expect(isClosed("paid")).toBe(true);
    expect(isClosed("lost")).toBe(true);
    expect(isClosed("canceled")).toBe(true);
    expect(isClosed("completed")).toBe(false);
    expect(isClosed("new_lead")).toBe(false);
  });
});

describe("views (§13.7)", () => {
  const job = (status: JobStatus, payment: PaymentStatus = "unpaid") => ({
    status,
    payment_status: payment,
  });

  it("exposes the eight specified views", () => {
    expect(JOB_VIEWS).toEqual([
      "all_jobs",
      "new_leads",
      "estimates",
      "scheduled",
      "in_progress",
      "completed",
      "unpaid",
      "lost",
    ]);
  });

  it("All Jobs holds every status", () => {
    expect(viewFilter("all_jobs")).toEqual({});
    for (const status of JOB_STATUSES) {
      expect(matchesView(job(status), "all_jobs")).toBe(true);
    }
  });

  it("routes each status to the views the owner expects", () => {
    expect(matchesView(job("new_lead"), "new_leads")).toBe(true);
    expect(matchesView(job("contacted"), "new_leads")).toBe(true);
    expect(matchesView(job("scheduled"), "new_leads")).toBe(false);

    expect(matchesView(job("estimate_draft"), "estimates")).toBe(true);
    expect(matchesView(job("estimate_sent"), "estimates")).toBe(true);
    expect(matchesView(job("estimate_accepted"), "estimates")).toBe(true);
    expect(matchesView(job("new_lead"), "estimates")).toBe(false);

    expect(matchesView(job("completed"), "completed")).toBe(true);
    expect(matchesView(job("paid", "paid"), "completed")).toBe(true);

    expect(matchesView(job("lost"), "lost")).toBe(true);
    expect(matchesView(job("canceled"), "lost")).toBe(true);
  });

  it("Unpaid means committed work that has not been collected in full", () => {
    expect(matchesView(job("completed", "unpaid"), "unpaid")).toBe(true);
    expect(matchesView(job("in_progress", "partial"), "unpaid")).toBe(true);
    expect(matchesView(job("estimate_accepted", "unpaid"), "unpaid")).toBe(true);

    // Collected, or never committed to, or written off — none of them owe money.
    expect(matchesView(job("completed", "paid"), "unpaid")).toBe(false);
    expect(matchesView(job("new_lead", "unpaid"), "unpaid")).toBe(false);
    expect(matchesView(job("estimate_sent", "unpaid"), "unpaid")).toBe(false);
    expect(matchesView(job("lost", "unpaid"), "unpaid")).toBe(false);
    expect(matchesView(job("canceled", "unpaid"), "unpaid")).toBe(false);
  });

  // A status added to the registry and nowhere else used to be invisible in
  // every classification the rest of the app reads. `JOB_STATUS_FACTS` makes
  // omission a compile error; these check the runtime side of the same claim.
  it("says what every status means, with nothing left over", () => {
    expect(Object.keys(JOB_STATUS_FACTS).sort()).toEqual([...JOB_STATUSES].sort());
  });

  it("derives the closed set rather than keeping a second copy of it", () => {
    expect([...CLOSED_STATUSES]).toEqual(["paid", "lost", "canceled"]);
    for (const status of JOB_STATUSES) {
      expect(isClosed(status)).toBe(JOB_STATUS_FACTS[status].closed);
      expect(CLOSED_STATUSES.includes(status)).toBe(isClosed(status));
    }
  });

  // §16.11: these three are written by the estimate. Naming them here is what
  // stops the two features drifting apart silently.
  it("marks exactly the estimate-written statuses as the estimate's", () => {
    expect(JOB_STATUSES.filter(isEstimateOwnedStatus)).toEqual([
      "estimate_draft",
      "estimate_sent",
      "estimate_accepted",
    ]);
  });

  it("agrees with the estimate model about which job statuses it writes", () => {
    for (const status of ESTIMATE_STATUSES) {
      const written = jobStatusForEstimate(status);
      if (written !== null) {
        expect(isJobStatus(written)).toBe(true);
        expect(isEstimateOwnedStatus(written as JobStatus)).toBe(true);
      }
    }
  });

  it("never calls an open job closed", () => {
    for (const status of JOB_STATUSES) {
      if (isEstimateOwnedStatus(status)) expect(isClosed(status)).toBe(false);
    }
  });

  it("every status appears in at least one view besides All Jobs", () => {
    const workingViews = JOB_VIEWS.filter((v) => v !== "all_jobs" && v !== "unpaid");
    for (const status of JOB_STATUSES) {
      const found = workingViews.some((view) => matchesView(job(status), view));
      expect(found, `status ${status} is not reachable from any view`).toBe(true);
    }
  });

  it("falls back to All Jobs for unknown or missing view parameters", () => {
    expect(parseView(undefined)).toBe("all_jobs");
    expect(parseView("nonsense")).toBe("all_jobs");
    expect(parseView("unpaid")).toBe("unpaid" satisfies JobView);
  });
});

describe("sorting (§13.8)", () => {
  it("defaults to newest first and ignores unknown values", () => {
    expect(parseSort(undefined)).toBe("newest");
    expect(parseSort("../../etc/passwd")).toBe("newest");
    expect(sortSpec(parseSort("oldest"))).toEqual({
      column: "created_at",
      ascending: true,
      nullsFirst: false,
    });
  });

  it("puts unscheduled jobs last when sorting by schedule", () => {
    expect(sortSpec("scheduled")).toEqual({
      column: "scheduled_start",
      ascending: true,
      nullsFirst: false,
    });
  });
});

describe("payment status derivation", () => {
  it("marking a job paid settles it", () => {
    expect(derivePaymentStatus("paid", "unpaid")).toBe("paid");
    expect(derivePaymentStatus("paid", "partial")).toBe("paid");
  });

  it("losing or canceling collected work flags a refund", () => {
    expect(derivePaymentStatus("lost", "paid")).toBe("refunded");
    expect(derivePaymentStatus("canceled", "paid")).toBe("refunded");
  });

  it("leaves every other combination to the owner", () => {
    expect(derivePaymentStatus("in_progress", "partial")).toBe("partial");
    expect(derivePaymentStatus("completed", "unpaid")).toBe("unpaid");
    expect(derivePaymentStatus("lost", "unpaid")).toBe("unpaid");
  });
});

describe("customer identity (§14.15 duplicate check)", () => {
  it("recognises the same phone written any of the usual ways", () => {
    expect(normalizePhone("(310) 555-0101")).toBe("3105550101");
    expect(normalizePhone("310-555-0101")).toBe("3105550101");
    expect(normalizePhone("+1 310 555 0101")).toBe("3105550101");
    expect(normalizePhone("13105550101")).toBe("3105550101");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("n/a")).toBeNull();
  });

  it("prefers phone, then email, then name", () => {
    expect(customerMatchKey({ phone: "310-555-0101", email: "a@b.c", name: "John" })).toBe(
      "phone:3105550101",
    );
    expect(customerMatchKey({ email: "John@Example.COM ", name: "John" })).toBe(
      "email:john@example.com",
    );
    expect(customerMatchKey({ name: "  John   Smith " })).toBe("name:john smith");
    expect(customerMatchKey({})).toBeNull();
  });

  it("does not collapse two customers who share nothing identifying", () => {
    expect(customerMatchKey({ name: "John Smith" })).not.toBe(
      customerMatchKey({ name: "Jane Smith" }),
    );
  });
});

describe("money parsing", () => {
  it("accepts what people actually type", () => {
    expect(parseMoney("280")).toBe(280);
    expect(parseMoney("$280.50")).toBe(280.5);
    expect(parseMoney("1,280.50")).toBe(1280.5);
    expect(parseMoney(" 1 280,50 ")).toBe(1280.5);
    expect(parseMoney("0")).toBe(0);
  });

  it("distinguishes blank from wrong", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney("abc")).toBeUndefined();
    expect(parseMoney("-10")).toBeUndefined();
    expect(parseMoney("12.34.56")).toBeUndefined();
  });

  it("rounds to cents", () => {
    expect(parseMoney("10.005")).toBe(10.01);
  });

  it("computes margin, treating missing materials as zero", () => {
    expect(jobMargin({ job_total: 280, materials_cost: 45 })).toBe(235);
    expect(jobMargin({ job_total: 280, materials_cost: null })).toBe(280);
    expect(jobMargin({ job_total: null, materials_cost: 45 })).toBeNull();
  });
});

describe("registries stay aligned with the migration", () => {
  it("locale registry matches the platform locales", () => {
    expect(CUSTOMER_LOCALES).toEqual(["en", "es"]);
  });

  it("lead sources match the onboarding list (§10.2 step 5)", () => {
    expect(LEAD_SOURCES).toEqual([
      "phone_call",
      "website",
      "thumbtack",
      "yelp",
      "google",
      "referral",
      "other",
    ]);
  });
});
