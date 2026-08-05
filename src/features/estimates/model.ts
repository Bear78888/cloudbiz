/**
 * Estimate domain model (§16).
 *
 * Pure: the arithmetic and the rules about what may follow what live here, so
 * they are decided by tests rather than by clicking through a form. The codes
 * are stable identifiers; the words a user sees come from the dictionaries.
 */

/** §16.8 verbatim. Order is the lifecycle, not an alphabet. */
export const ESTIMATE_STATUSES = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const ESTIMATE_ITEM_TYPES = ["labor", "material", "fee", "discount"] as const;
export type EstimateItemType = (typeof ESTIMATE_ITEM_TYPES)[number];

export function isEstimateStatus(value: string): value is EstimateStatus {
  return (ESTIMATE_STATUSES as readonly string[]).includes(value);
}

/**
 * Upper bound on the tax rate, matching `estimates_tax_rate_check`.
 *
 * Loose enough for any real US combined rate, tight enough that `8.25` entered
 * where `0.0825` was meant fails validation instead of multiplying an invoice
 * by a hundred.
 */
export const MAX_TAX_RATE = 0.5;

/**
 * Which statuses may follow which.
 *
 * `sent` is reachable only from `ready`, and `ready` only by an explicit
 * approval — that is §16.5 expressed as a state machine rather than as a
 * warning in the interface. A draft cannot be sent by accident because there is
 * no edge for it.
 *
 * Nothing leads out of `accepted` or `rejected`: the customer's answer is not
 * something the sender may revise. A changed price is a new version (§25.3).
 */
const TRANSITIONS: Record<EstimateStatus, readonly EstimateStatus[]> = {
  draft: ["ready", "expired"],
  ready: ["draft", "sent", "expired"],
  sent: ["viewed", "accepted", "rejected", "expired"],
  viewed: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

export function canTransition(from: EstimateStatus, to: EstimateStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses the customer has already seen. Editing one is making a new version. */
export function isReleased(status: EstimateStatus): boolean {
  return status === "sent" || status === "viewed" || status === "accepted" || status === "rejected";
}

export interface LineItemInput {
  itemType: EstimateItemType;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface LineItem extends LineItemInput {
  total: number;
}

export interface EstimateTotals {
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

/** Rounds to cents. Money that carries floating-point dust stops adding up. */
function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The unit price as it should be stored, given the kind of line.
 *
 * A discount is entered as an amount off — `50`, not `-50` — because that is
 * how someone writing it says it, and the sign is then not something the user
 * can get wrong. Typing the minus anyway must not turn the discount into a
 * surcharge, so the magnitude is taken either way.
 */
export function signedUnitPrice(itemType: EstimateItemType, entered: number): number {
  return itemType === "discount" ? -Math.abs(entered) : entered;
}

/** The magnitude to show back in the editor for a stored unit price. */
export function unitPriceForEditing(itemType: EstimateItemType, stored: number): number {
  return itemType === "discount" ? Math.abs(stored) : stored;
}

/**
 * Line totals, subtotal, tax and total.
 *
 * `taxRate` is a fraction (0.0825), applied to the taxable subtotal only.
 * Discounts reduce the taxable base — charging tax on money the customer was
 * never asked for would be wrong in the direction that costs them.
 */
export function computeTotals(items: LineItemInput[], taxRate = 0): EstimateTotals {
  const priced: LineItem[] = items.map((item) => ({
    ...item,
    total: money(item.quantity * item.unitPrice),
  }));

  const subtotal = money(priced.reduce((sum, item) => sum + item.total, 0));
  const tax = money(Math.max(0, subtotal) * taxRate);

  return { items: priced, subtotal, tax, total: money(subtotal + tax) };
}

/**
 * §16.11: the estimate's status drives the job's.
 *
 * Returns the job status this estimate implies, or null when the estimate does
 * not speak for the job. A rejected estimate deliberately does *not* move the
 * job to `lost`: the customer refused this price, which is not the same as the
 * work going away, and marking it lost would delete the follow-up from the
 * owner's list.
 */
export function jobStatusForEstimate(status: EstimateStatus): string | null {
  switch (status) {
    case "draft":
    case "ready":
      return "estimate_draft";
    case "sent":
    case "viewed":
      return "estimate_sent";
    case "accepted":
      return "estimate_accepted";
    default:
      return null;
  }
}

/**
 * What is missing from the document itself.
 *
 * Deliberately not "is it valid" but "is there something here to approve": an
 * estimate with no lines and a zero total satisfies every constraint in the
 * schema and is useless to put in front of a customer.
 */
export function contentBlockers(estimate: {
  itemCount: number;
  total: number;
  title: string;
}): string[] {
  const blockers: string[] = [];
  if (estimate.itemCount === 0) blockers.push("no_items");
  if (estimate.total <= 0) blockers.push("zero_total");
  if (estimate.title.trim().length === 0) blockers.push("no_title");
  return blockers;
}

/**
 * Whether this estimate may be sent (§16.5).
 *
 * Approval is a separate blocker from content, because they are fixed in
 * different places: an unapproved estimate needs a decision, an empty one needs
 * editing. Reporting them together lets the interface say both at once instead
 * of one per attempt.
 */
export function blockersForSending(estimate: {
  status: EstimateStatus;
  items: LineItemInput[];
  total: number;
  title: string;
}): string[] {
  const blockers = estimate.status === "ready" ? [] : ["not_approved"];
  return [...blockers, ...contentBlockers({ ...estimate, itemCount: estimate.items.length })];
}
