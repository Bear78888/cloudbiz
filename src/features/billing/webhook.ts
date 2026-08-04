import { isBillableProductCode, type BillableProductCode } from "@/features/billing/catalog";
import { resolveEntitlements, SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/features/entitlements/logic";
import type { BillingStore } from "@/features/billing/store";

/**
 * Stripe webhook processing core. Pure logic over the injected store:
 * the route handler verifies the signature, extracts a normalized event and
 * delegates here. Error taxonomy per audit §4.2 — a retryable failure makes
 * the route answer 500 (Stripe retries), a non-retryable one is recorded and
 * acknowledged with 200 so a broken event cannot loop forever.
 */

export class NonRetryableWebhookError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "NonRetryableWebhookError";
  }
}

export interface NormalizedStripeEvent {
  id: string;
  type: string;
  /** Set for customer.subscription.* events. */
  subscription?: {
    id: string;
    customerId: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: number | null;
    currentPeriodEnd: number | null;
    /** metadata.organization_id / metadata.product_code set at Checkout. */
    metadata: Record<string, string>;
  };
}

const HANDLED_EVENT_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export function isHandledEventType(type: string): boolean {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

function toIsoOrNull(epochSeconds: number | null): string | null {
  return epochSeconds === null ? null : new Date(epochSeconds * 1000).toISOString();
}

function parseStatus(raw: string): SubscriptionStatus {
  if ((SUBSCRIPTION_STATUSES as readonly string[]).includes(raw)) {
    return raw as SubscriptionStatus;
  }
  throw new NonRetryableWebhookError("unknown_status", `Unknown subscription status: ${raw}`);
}

function parseProductCode(metadata: Record<string, string>): BillableProductCode {
  const code = metadata.product_code ?? "";
  if (!isBillableProductCode(code)) {
    throw new NonRetryableWebhookError(
      "unknown_product",
      "Subscription metadata is missing a known product_code",
    );
  }
  return code;
}

export type ProcessResult =
  | { outcome: "processed"; organizationId: string }
  | { outcome: "ignored"; reason: string };

/**
 * Handle a subscription lifecycle event: upsert the local cache row, then
 * recompute and persist the organization's full entitlement set (§6.2.3).
 * `deleted` maps to status canceled regardless of the payload snapshot.
 */
export async function processSubscriptionEvent(
  event: NormalizedStripeEvent,
  store: BillingStore,
): Promise<ProcessResult> {
  if (!isHandledEventType(event.type)) {
    return { outcome: "ignored", reason: `unhandled_event_type:${event.type}` };
  }
  const subscription = event.subscription;
  if (!subscription) {
    throw new NonRetryableWebhookError("missing_subscription", "Event has no subscription payload");
  }

  const organizationId =
    subscription.metadata.organization_id ||
    (await store.findOrganizationIdByStripeCustomer(subscription.customerId));
  if (!organizationId) {
    // A subscription we cannot attribute (e.g. created manually in the Stripe
    // dashboard without metadata) must not crash the endpoint forever.
    throw new NonRetryableWebhookError(
      "unattributed_subscription",
      "No organization_id in metadata and customer is unknown",
    );
  }

  const productCode = parseProductCode(subscription.metadata);
  const status: SubscriptionStatus =
    event.type === "customer.subscription.deleted" ? "canceled" : parseStatus(subscription.status);

  await store.upsertSubscription({
    organizationId,
    stripeCustomerId: subscription.customerId,
    stripeSubscriptionId: subscription.id,
    productCode,
    status,
    currentPeriodStart: toIsoOrNull(subscription.currentPeriodStart),
    currentPeriodEnd: toIsoOrNull(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  });

  const allSubscriptions = await store.listOrganizationSubscriptions(organizationId);
  const entitlements = resolveEntitlements(allSubscriptions);
  await store.replaceEntitlements(organizationId, entitlements);

  await store.appendAuditLog({
    organizationId,
    action: `billing.subscription.${status}`,
    targetType: "subscription",
    targetId: subscription.id,
    afterData: {
      product_code: productCode,
      status,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
    },
  });

  return { outcome: "processed", organizationId };
}
