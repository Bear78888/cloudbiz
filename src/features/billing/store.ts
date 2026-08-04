import type { ResolvedEntitlement, SubscriptionStatus } from "@/features/entitlements/logic";
import type { BillableProductCode } from "@/features/billing/catalog";

/**
 * Store interface for billing (audit §4.2: pure logic over an injectable
 * store). The webhook handler and checkout flow only talk to this interface;
 * production wires it to the Supabase admin client, tests to an in-memory fake.
 */

/** Admission verdict for an incoming webhook event (idempotency, §26.4). */
export type EventAdmission =
  | { kind: "new" }
  | { kind: "retry" } // seen before but previous processing failed — process again
  | { kind: "duplicate" }; // processed or in flight — acknowledge without side effects

export interface WebhookEventInput {
  provider: "stripe";
  externalEventId: string;
  eventType: string;
  signatureVerified: boolean;
  payloadHash: string;
  /** Only non-sensitive identifiers — never the raw provider payload. */
  sanitizedPayload: Record<string, unknown>;
}

export interface SubscriptionUpsert {
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  productCode: BillableProductCode;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface OrganizationSubscriptionRow {
  productCode: BillableProductCode;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

export interface BillingStore {
  admitWebhookEvent(event: WebhookEventInput): Promise<EventAdmission>;
  markWebhookEventProcessed(provider: "stripe", externalEventId: string): Promise<void>;
  markWebhookEventFailed(
    provider: "stripe",
    externalEventId: string,
    errorCode: string,
  ): Promise<void>;

  upsertSubscription(subscription: SubscriptionUpsert): Promise<void>;
  listOrganizationSubscriptions(organizationId: string): Promise<OrganizationSubscriptionRow[]>;
  /** Look up the organization for a Stripe customer from previously cached subscriptions. */
  findOrganizationIdByStripeCustomer(stripeCustomerId: string): Promise<string | null>;

  replaceEntitlements(
    organizationId: string,
    entitlements: readonly ResolvedEntitlement[],
  ): Promise<void>;

  appendAuditLog(entry: {
    organizationId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    afterData: Record<string, unknown>;
  }): Promise<void>;
}
