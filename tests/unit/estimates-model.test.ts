import { describe, expect, it } from "vitest";

import {
  ESTIMATE_STATUSES,
  blockersForSending,
  canTransition,
  computeTotals,
  isEstimateStatus,
  isReleased,
  jobStatusForEstimate,
  type EstimateStatus,
} from "@/features/estimates/model";
import { JOB_STATUSES } from "@/features/jobs/model";

describe("status registry (§16.8)", () => {
  it("is exactly the spec's list, in lifecycle order", () => {
    expect([...ESTIMATE_STATUSES]).toEqual([
      "draft",
      "ready",
      "sent",
      "viewed",
      "accepted",
      "rejected",
      "expired",
    ]);
  });

  it("recognises its own codes and nothing else", () => {
    expect(isEstimateStatus("accepted")).toBe(true);
    expect(isEstimateStatus("approved")).toBe(false);
    expect(isEstimateStatus("'; drop table estimates; --")).toBe(false);
  });
});

describe("what may follow what", () => {
  // §16.5 as a state machine: a draft has no edge to `sent`, so it cannot be
  // sent by accident. The approval step is the only way through.
  it("refuses to send anything that was not approved", () => {
    expect(canTransition("draft", "sent")).toBe(false);
    expect(canTransition("draft", "ready")).toBe(true);
    expect(canTransition("ready", "sent")).toBe(true);
  });

  it("lets an approval be taken back while it is still unsent", () => {
    expect(canTransition("ready", "draft")).toBe(true);
    expect(canTransition("sent", "draft")).toBe(false);
  });

  // The customer's answer is not something the sender may revise. A different
  // price is a new version (§25.3), not an edit of the answered document.
  it("treats the customer's answer as final", () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(canTransition("accepted", status)).toBe(false);
      expect(canTransition("rejected", status)).toBe(false);
    }
  });

  it("knows which statuses the customer has already seen", () => {
    expect(isReleased("draft")).toBe(false);
    expect(isReleased("ready")).toBe(false);
    expect(isReleased("sent")).toBe(true);
    expect(isReleased("accepted")).toBe(true);
  });

  it("can expire from anything not yet answered", () => {
    for (const status of ["draft", "ready", "sent", "viewed"] as EstimateStatus[]) {
      expect(canTransition(status, "expired")).toBe(true);
    }
  });
});

describe("the arithmetic", () => {
  const items = [
    { itemType: "labor" as const, description: "2 hours", quantity: 2, unitPrice: 90 },
    { itemType: "material" as const, description: "Faucet", quantity: 1, unitPrice: 120.5 },
  ];

  it("prices each line and adds them up", () => {
    const totals = computeTotals(items);
    expect(totals.items.map((item) => item.total)).toEqual([180, 120.5]);
    expect(totals.subtotal).toBe(300.5);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(300.5);
  });

  it("applies tax to the subtotal", () => {
    const totals = computeTotals(items, 0.0825);
    expect(totals.tax).toBe(24.79);
    expect(totals.total).toBe(325.29);
  });

  // Money carrying floating-point dust stops adding up, and the place it shows
  // is a customer's invoice.
  it("rounds to cents rather than accumulating dust", () => {
    const totals = computeTotals(
      [{ itemType: "labor", description: "Odd", quantity: 3, unitPrice: 33.333 }],
      0.1,
    );
    expect(totals.subtotal).toBe(100);
    expect(totals.tax).toBe(10);
    expect(totals.total).toBe(110);
  });

  // Charging tax on money the customer was never asked for is wrong in the
  // direction that costs them.
  it("lets a discount reduce the taxable base", () => {
    const totals = computeTotals(
      [
        { itemType: "labor", description: "Work", quantity: 1, unitPrice: 200 },
        { itemType: "discount", description: "Repeat customer", quantity: 1, unitPrice: -50 },
      ],
      0.1,
    );
    expect(totals.subtotal).toBe(150);
    expect(totals.tax).toBe(15);
    expect(totals.total).toBe(165);
  });

  it("handles an empty estimate without producing NaN", () => {
    expect(computeTotals([], 0.0825)).toEqual({ items: [], subtotal: 0, tax: 0, total: 0 });
  });
});

describe("what the estimate says about the job (§16.11)", () => {
  it("maps to job statuses that actually exist", () => {
    for (const status of ESTIMATE_STATUSES) {
      const jobStatus = jobStatusForEstimate(status);
      if (jobStatus !== null) {
        expect(JOB_STATUSES as readonly string[]).toContain(jobStatus);
      }
    }
  });

  it("follows the spec's three transitions", () => {
    expect(jobStatusForEstimate("draft")).toBe("estimate_draft");
    expect(jobStatusForEstimate("sent")).toBe("estimate_sent");
    expect(jobStatusForEstimate("accepted")).toBe("estimate_accepted");
  });

  // Deliberate: the customer refused this price, which is not the same as the
  // work going away. Marking the job lost would drop it off the owner's list.
  it("does not mark the job lost when an estimate is rejected", () => {
    expect(jobStatusForEstimate("rejected")).toBeNull();
    expect(jobStatusForEstimate("expired")).toBeNull();
  });
});

describe("what stops an estimate from being sent (§16.5)", () => {
  const ready = {
    status: "ready" as EstimateStatus,
    items: [{ itemType: "labor" as const, description: "Work", quantity: 1, unitPrice: 100 }],
    total: 100,
    title: "Faucet replacement",
  };

  it("passes an approved estimate with something in it", () => {
    expect(blockersForSending(ready)).toEqual([]);
  });

  it("refuses an unapproved one", () => {
    expect(blockersForSending({ ...ready, status: "draft" })).toContain("not_approved");
  });

  // Technically consistent and useless to send.
  it("refuses an empty or free one", () => {
    expect(blockersForSending({ ...ready, items: [], total: 0 })).toEqual(
      expect.arrayContaining(["no_items", "zero_total"]),
    );
  });

  it("reports every blocker at once rather than one per attempt", () => {
    const blockers = blockersForSending({ status: "draft", items: [], total: 0, title: "  " });
    expect(blockers).toEqual(
      expect.arrayContaining(["not_approved", "no_items", "zero_total", "no_title"]),
    );
  });
});
