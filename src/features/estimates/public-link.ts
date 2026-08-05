/**
 * The customer-facing estimate link (§16).
 *
 * This is the first surface of the product a stranger can reach, so the rules
 * about what it shows and when it stops working live here, pure and tested,
 * rather than being spread across a page component.
 *
 * Three things it exists to decide:
 *  - whether a token is even worth a database query (shape check first),
 *  - whether the estimate behind it may still be shown (lifetime, §16.8),
 *  - what may appear on the page (an allow-list, not "everything but").
 */

import type { EstimateStatus } from "./model";

/**
 * How long a sent estimate stays openable.
 *
 * 30 days: long enough that a customer deciding over a couple of weekends
 * still has a working link, short enough that a price quoted last spring is
 * not still live when materials cost more. The owner can end it sooner by
 * withdrawing the estimate, which is the control that matters — this is only
 * the backstop for the link nobody came back to.
 */
export const ESTIMATE_LINK_DAYS = 30;

export function expiryFor(sentAtIso: string): string {
  const sentAt = new Date(sentAtIso).getTime();
  return new Date(sentAt + ESTIMATE_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Token shape.
 *
 * `randomBytes(32).toString("base64url")` is always 43 characters of
 * `[A-Za-z0-9_-]`. Checking that before querying means a scanner throwing paths
 * at the route never reaches the database, and the check costs nothing.
 *
 * It is a cheap filter, not a security boundary: the boundary is that the token
 * is 256 random bits and the lookup is an equality match on a unique column.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedToken(value: string): boolean {
  return TOKEN_SHAPE.test(value);
}

/**
 * What a visitor holding this token is allowed to see.
 *
 * `gone` covers both "no such token" and "the owner withdrew it": withdrawal
 * nulls the token, so those two are the same state by construction rather than
 * by a branch someone has to remember to write. `expired` is deliberately
 * distinguishable — whoever holds the link already had it, and telling them it
 * lapsed is more useful than pretending it never existed. That distinction is
 * safe only because a token cannot be guessed; it is not a hint about a secret
 * the visitor does not already hold.
 */
export type LinkState = "ok" | "expired" | "gone";

/**
 * Statuses whose estimate the customer is allowed to open.
 *
 * Written out rather than derived from `isReleased`, and listed positively: the
 * question "did we send this to them" is not the same question as "may they
 * open it", and the estimate bug that reached production came from answering
 * one with the other.
 */
export const CUSTOMER_VISIBLE_STATUSES: readonly EstimateStatus[] = [
  "sent",
  "viewed",
  "accepted",
  "rejected",
];

export function linkState(
  estimate: { status: EstimateStatus; expiresAt: string | null } | null,
  now: Date,
): LinkState {
  if (!estimate) return "gone";
  if (estimate.status === "expired") return "expired";

  // A draft or an approved-but-unsent estimate has no business being reachable
  // even if a token somehow exists: it was never given to anyone.
  if (!CUSTOMER_VISIBLE_STATUSES.includes(estimate.status)) return "gone";

  if (estimate.expiresAt && new Date(estimate.expiresAt).getTime() <= now.getTime()) {
    return "expired";
  }
  return "ok";
}

/** Whether the customer may still answer, or has already answered (§16.5). */
export function canCustomerAnswer(status: EstimateStatus): boolean {
  return status === "sent" || status === "viewed";
}

/**
 * Every column the public page may read.
 *
 * An allow-list, because the failure that matters here is silent: one
 * `select("*")`, or one column added to the table, and the page starts serving
 * something nobody decided to publish. Notably absent — the customer's phone,
 * email and address, the job, the internal notes, and anything belonging to
 * another customer. A visitor gets the document and who sent it, that is all.
 *
 * Kept as literal strings rather than arrays joined at runtime, because the
 * generated `Database` types only check a `select()` whose argument is a
 * literal. A `.join(", ")` here would read as more structured and would quietly
 * give up the compile-time check that a column exists — the check that exists
 * because `.select("lead_source")` once shipped against a column named `source`.
 * `parseColumns` below re-derives the list for the tests, so the literal stays
 * the single source of truth.
 */
export const PUBLIC_ESTIMATE_SELECT =
  "id, organization_id, status, locale, title, scope, terms, subtotal, tax, tax_rate, total, sent_at, expires_at, accepted_at, rejected_at";

export const PUBLIC_ITEM_SELECT =
  "id, item_type, description, quantity, unit_price, total, sort_order";

/** The only thing shown about the business: who the estimate is from. */
export const PUBLIC_ORGANIZATION_SELECT = "name, currency";

/** Splits a select list back into column names, for assertions about it. */
export function parseColumns(select: string): string[] {
  return select.split(",").map((column) => column.trim()).filter(Boolean);
}

/**
 * Sanity check used by the tests: no column named here may be one of the
 * fields that identify or describe a person, wherever it came from.
 */
export const FORBIDDEN_PUBLIC_FIELDS = [
  "phone",
  "phone_digits",
  "email",
  "address",
  "notes",
  "sms_consent",
  "customer_id",
  "job_id",
  "assigned_user_id",
  "public_token",
  "pdf_path",
  "slug",
] as const;
