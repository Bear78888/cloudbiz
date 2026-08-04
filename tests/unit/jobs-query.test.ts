import { describe, expect, it } from "vitest";

import { buildJobsHref } from "@/features/jobs/JobsFilters";
import {
  MAX_SEARCH_LENGTH,
  buildJobSearchFilter,
  countForDashboard,
  groupByPaymentOutcome,
  likePattern,
  quoteFilterValue,
} from "@/features/jobs/model";

/**
 * The search filter is assembled into a PostgREST filter string by hand, so
 * these tests are the guard against a customer name or a search term being
 * read as filter syntax.
 */

describe("search patterns (§13.8)", () => {
  it("wraps the term in wildcards", () => {
    expect(likePattern("faucet")).toBe("%faucet%");
    expect(likePattern("  faucet  ")).toBe("%faucet%");
  });

  it("escapes wildcards the user typed, so they match literally", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("back\\slash")).toBe("%back\\\\slash%");
  });

  it("caps the term so a huge query cannot be pushed through", () => {
    expect(likePattern("x".repeat(500)).length).toBe(MAX_SEARCH_LENGTH + 2);
  });

  it("quotes values that would otherwise be read as filter syntax", () => {
    expect(quoteFilterValue("%Smith, John%")).toBe('"%Smith, John%"');
    expect(quoteFilterValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteFilterValue("a\\b")).toBe('"a\\\\b"');
  });

  it("keeps a comma, a parenthesis and a quote inside the quoted value", () => {
    const filter = buildJobSearchFilter('Smith, John (Jr) "Bo"', []);
    // One clause per column and nothing more: the punctuation did not split it.
    expect(filter.split('",').length).toBe(5);
    expect(filter.startsWith("title.ilike.")).toBe(true);
  });

  it("covers every searchable column and folds in matching customers", () => {
    const withCustomers = buildJobSearchFilter("faucet", ["id-1", "id-2"]);
    for (const column of ["title", "service", "description", "address", "notes"]) {
      expect(withCustomers).toContain(`${column}.ilike.`);
    }
    expect(withCustomers).toContain("customer_id.in.(id-1,id-2)");
  });

  it("omits the customer clause when nothing matched", () => {
    expect(buildJobSearchFilter("faucet", [])).not.toContain("customer_id");
  });
});

describe("dashboard counters (§20.2)", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");
  const job = (
    status: string,
    payment = "unpaid",
    scheduled: string | null = null,
  ) =>
    ({ status, payment_status: payment, scheduled_start: scheduled }) as Parameters<
      typeof countForDashboard
    >[0][number];

  it("counts nothing for an empty tracker", () => {
    expect(countForDashboard([], now)).toEqual({
      newLeads: 0,
      estimatesWaiting: 0,
      jobsThisWeek: 0,
      unpaidJobs: 0,
    });
  });

  it("agrees with the views it links to", () => {
    const counters = countForDashboard(
      [
        job("new_lead"),
        job("contacted"),
        job("estimate_sent"),
        job("estimate_draft"),
        job("estimate_accepted"),
        job("completed", "paid"),
        job("completed", "unpaid"),
      ],
      now,
    );
    expect(counters.newLeads).toBe(2);
    expect(counters.estimatesWaiting).toBe(2);
    // estimate_accepted + completed/unpaid owe money; completed/paid does not.
    expect(counters.unpaidJobs).toBe(2);
  });

  it("counts the next seven days of scheduled work, not the past", () => {
    const counters = countForDashboard(
      [
        job("scheduled", "unpaid", "2026-08-05T15:00:00.000Z"),
        job("scheduled", "unpaid", "2026-08-10T15:00:00.000Z"),
        job("scheduled", "unpaid", "2026-08-20T15:00:00.000Z"),
        job("scheduled", "unpaid", "2026-08-01T15:00:00.000Z"),
        job("scheduled", "unpaid", null),
      ],
      now,
    );
    expect(counters.jobsThisWeek).toBe(2);
  });

  it("ignores work that is already lost or canceled", () => {
    const counters = countForDashboard(
      [
        job("canceled", "unpaid", "2026-08-05T15:00:00.000Z"),
        job("lost", "unpaid", "2026-08-05T15:00:00.000Z"),
        job("in_progress", "unpaid", "2026-08-05T15:00:00.000Z"),
      ],
      now,
    );
    expect(counters.jobsThisWeek).toBe(1);
  });

  it("survives an unparseable scheduled date instead of throwing", () => {
    expect(countForDashboard([job("scheduled", "unpaid", "not-a-date")], now).jobsThisWeek).toBe(0);
  });
});

describe("list URLs", () => {
  it("keeps the default view and sort out of the query string", () => {
    expect(buildJobsHref("en", { view: "all_jobs", sort: "newest" })).toBe("/en/app/jobs");
  });

  it("round-trips the filter state", () => {
    const href = buildJobsHref("es", {
      view: "unpaid",
      sort: "amount",
      q: "faucet",
      status: "completed",
      priority: "urgent",
      page: 3,
    });
    expect(href.startsWith("/es/app/jobs?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("view")).toBe("unpaid");
    expect(params.get("sort")).toBe("amount");
    expect(params.get("q")).toBe("faucet");
    expect(params.get("status")).toBe("completed");
    expect(params.get("priority")).toBe("urgent");
    expect(params.get("page")).toBe("3");
  });

  it("escapes a search term rather than breaking the URL", () => {
    const href = buildJobsHref("en", { q: "a&b=c d" });
    expect(new URLSearchParams(href.split("?")[1]).get("q")).toBe("a&b=c d");
  });

  it("drops page 1 so the first page has one canonical URL", () => {
    expect(buildJobsHref("en", { view: "lost", page: 1 })).toBe("/en/app/jobs?view=lost");
  });
});

describe("bulk status change (§13.8)", () => {
  it("collapses to a single update when every job ends up the same", () => {
    const grouped = groupByPaymentOutcome(
      [
        { id: "a", payment_status: "unpaid" },
        { id: "b", payment_status: "partial" },
        { id: "c", payment_status: "paid" },
      ],
      "paid",
    );
    // Marking work paid settles all three, so one UPDATE covers the selection.
    expect([...grouped.keys()]).toEqual(["paid"]);
    expect(grouped.get("paid")).toEqual(["a", "b", "c"]);
  });

  it("splits when the outcome differs per job", () => {
    const grouped = groupByPaymentOutcome(
      [
        { id: "a", payment_status: "paid" },
        { id: "b", payment_status: "unpaid" },
      ],
      "canceled",
    );
    // Canceling collected work flags a refund; unpaid work just stays unpaid.
    expect(grouped.get("refunded")).toEqual(["a"]);
    expect(grouped.get("unpaid")).toEqual(["b"]);
  });

  it("never needs more updates than there are payment statuses", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: `job-${i}`,
      payment_status: (["unpaid", "partial", "paid", "refunded"] as const)[i % 4],
    }));
    expect(groupByPaymentOutcome(many, "in_progress").size).toBeLessThanOrEqual(4);
    expect(groupByPaymentOutcome(many, "paid").size).toBe(1);
  });

  it("returns nothing for an empty selection", () => {
    expect(groupByPaymentOutcome([], "scheduled").size).toBe(0);
  });
});
