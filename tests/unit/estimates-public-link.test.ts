import { describe, expect, it } from "vitest";

import {
  CUSTOMER_VISIBLE_STATUSES,
  ESTIMATE_LINK_DAYS,
  FORBIDDEN_PUBLIC_FIELDS,
  PUBLIC_ESTIMATE_SELECT,
  PUBLIC_ITEM_SELECT,
  PUBLIC_ORGANIZATION_SELECT,
  canCustomerAnswer,
  expiryFor,
  isWellFormedToken,
  linkState,
  parseColumns,
} from "@/features/estimates/public-link";
import { ESTIMATE_STATUSES, type EstimateStatus } from "@/features/estimates/model";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function sent(overrides: Partial<{ status: EstimateStatus; expiresAt: string | null }> = {}) {
  return { status: "sent" as EstimateStatus, expiresAt: null, ...overrides };
}

describe("token shape", () => {
  // 32 random bytes as base64url is always 43 characters. Checking that before
  // querying means a scanner never reaches the database.
  it("accepts what the generator produces", () => {
    const real = Buffer.from(new Uint8Array(32).fill(7)).toString("base64url");
    expect(real).toHaveLength(43);
    expect(isWellFormedToken(real)).toBe(true);
  });

  it("rejects everything that is not that", () => {
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("a".repeat(42))).toBe(false);
    expect(isWellFormedToken("a".repeat(44))).toBe(false);
    // Padding, slashes and plus are base64 but not base64url.
    expect(isWellFormedToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isWellFormedToken(`${"a".repeat(42)}/`)).toBe(false);
    expect(isWellFormedToken(`${"a".repeat(42)}+`)).toBe(false);
  });

  // The two shapes an attacker actually types into a URL bar.
  it("rejects path traversal and SQL-ish input without touching a database", () => {
    expect(isWellFormedToken("../../etc/passwd")).toBe(false);
    expect(isWellFormedToken("' or 1=1 --")).toBe(false);
    expect(isWellFormedToken("%2e%2e%2f")).toBe(false);
  });
});

describe("what a visitor may open", () => {
  it("shows an estimate that was actually sent", () => {
    expect(linkState(sent(), NOW)).toBe("ok");
    expect(linkState(sent({ status: "viewed" }), NOW)).toBe("ok");
  });

  // The customer's own answer stays readable — they should be able to reopen
  // the thing they agreed to.
  it("keeps showing an answered estimate", () => {
    expect(linkState(sent({ status: "accepted" }), NOW)).toBe("ok");
    expect(linkState(sent({ status: "rejected" }), NOW)).toBe("ok");
  });

  // The important one: a draft is not a document, even if a token exists.
  it("refuses anything that was never sent", () => {
    expect(linkState(sent({ status: "draft" }), NOW)).toBe("gone");
    expect(linkState(sent({ status: "ready" }), NOW)).toBe("gone");
  });

  it("refuses a token that matches nothing", () => {
    expect(linkState(null, NOW)).toBe("gone");
  });

  it("refuses a withdrawn estimate", () => {
    expect(linkState(sent({ status: "expired" }), NOW)).toBe("expired");
  });

  it("stops working once the date passes", () => {
    const yesterday = new Date(NOW.getTime() - 86_400_000).toISOString();
    const tomorrow = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(linkState(sent({ expiresAt: yesterday }), NOW)).toBe("expired");
    expect(linkState(sent({ expiresAt: tomorrow }), NOW)).toBe("ok");
    // The boundary belongs to the past: at the stroke of expiry it is expired.
    expect(linkState(sent({ expiresAt: NOW.toISOString() }), NOW)).toBe("expired");
  });

  // Every status must have a decided answer — a new one must not default to
  // "visible" by falling through.
  it("decides every status, and only the sent ones are visible", () => {
    for (const status of ESTIMATE_STATUSES) {
      const state = linkState(sent({ status }), NOW);
      expect(["ok", "expired", "gone"]).toContain(state);
      if (state === "ok") expect(CUSTOMER_VISIBLE_STATUSES).toContain(status);
    }
  });

  it("lets the customer answer only while the answer is still open", () => {
    expect(canCustomerAnswer("sent")).toBe(true);
    expect(canCustomerAnswer("viewed")).toBe(true);
    expect(canCustomerAnswer("accepted")).toBe(false);
    expect(canCustomerAnswer("rejected")).toBe(false);
    expect(canCustomerAnswer("draft")).toBe(false);
    expect(canCustomerAnswer("expired")).toBe(false);
  });
});

describe("link lifetime", () => {
  it("is thirty days from sending", () => {
    expect(ESTIMATE_LINK_DAYS).toBe(30);
    expect(expiryFor("2026-08-05T12:00:00.000Z")).toBe("2026-09-04T12:00:00.000Z");
  });

  it("survives a month boundary and a leap day", () => {
    expect(expiryFor("2026-01-31T00:00:00.000Z")).toBe("2026-03-02T00:00:00.000Z");
    expect(expiryFor("2028-02-01T00:00:00.000Z")).toBe("2028-03-02T00:00:00.000Z");
  });
});

describe("what the public page is allowed to read", () => {
  const everySelectedColumn = [
    ...parseColumns(PUBLIC_ESTIMATE_SELECT),
    ...parseColumns(PUBLIC_ITEM_SELECT),
    ...parseColumns(PUBLIC_ORGANIZATION_SELECT),
  ];

  // The assertion that matters on this surface. If someone adds a column to a
  // select here — for a feature, for debugging — and it is one of these, this
  // fails before it can be served to a stranger.
  it("names no field that identifies or describes a person", () => {
    for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
      expect(
        everySelectedColumn,
        `"${forbidden}" must never be read by the public estimate page`,
      ).not.toContain(forbidden);
    }
  });

  it("never selects everything", () => {
    for (const select of [
      PUBLIC_ESTIMATE_SELECT,
      PUBLIC_ITEM_SELECT,
      PUBLIC_ORGANIZATION_SELECT,
    ]) {
      expect(select).not.toContain("*");
      expect(parseColumns(select).length).toBeGreaterThan(0);
    }
  });

  // An embedded select would pull a related table in wholesale, which is
  // exactly how a customer list ends up on a public page.
  it("joins nothing", () => {
    for (const select of [
      PUBLIC_ESTIMATE_SELECT,
      PUBLIC_ITEM_SELECT,
      PUBLIC_ORGANIZATION_SELECT,
    ]) {
      expect(select).not.toContain("(");
      expect(select).not.toContain(":");
    }
  });

  it("tells the visitor who it is from and nothing else about the business", () => {
    expect(parseColumns(PUBLIC_ORGANIZATION_SELECT)).toEqual(["name", "currency"]);
  });

  it("does not hand the token back out", () => {
    expect(everySelectedColumn).not.toContain("public_token");
  });
});
