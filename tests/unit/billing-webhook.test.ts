import { describe, expect, it } from "vitest";

import {
  NonRetryableWebhookError,
  processSubscriptionEvent,
  type NormalizedStripeEvent,
} from "@/features/billing/webhook";
import type {
  BillingStore,
  OrganizationSubscriptionRow,
  SubscriptionUpsert,
} from "@/features/billing/store";
import type { ResolvedEntitlement } from "@/features/entitlements/logic";

interface FakeState {
  subscriptions: Map<string, SubscriptionUpsert>;
  entitlements: Map<string, readonly ResolvedEntitlement[]>;
  auditActions: string[];
}

function createFakeStore(state: FakeState): BillingStore {
  return {
    async admitWebhookEvent() {
      return { kind: "new" };
    },
    async markWebhookEventProcessed() {},
    async markWebhookEventFailed() {},
    async upsertSubscription(subscription) {
      state.subscriptions.set(subscription.stripeSubscriptionId, subscription);
    },
    async listOrganizationSubscriptions(organizationId): Promise<OrganizationSubscriptionRow[]> {
      return [...state.subscriptions.values()]
        .filter((s) => s.organizationId === organizationId)
        .map((s) => ({
          productCode: s.productCode,
          status: s.status,
          currentPeriodEnd: s.currentPeriodEnd,
        }));
    },
    async findOrganizationIdByStripeCustomer(customerId) {
      return (
        [...state.subscriptions.values()].find((s) => s.stripeCustomerId === customerId)
          ?.organizationId ?? null
      );
    },
    async replaceEntitlements(organizationId, entitlements) {
      state.entitlements.set(organizationId, entitlements);
    },
    async appendAuditLog(entry) {
      state.auditActions.push(entry.action);
    },
  };
}

function subscriptionEvent(overrides: {
  type?: string;
  metadata?: Record<string, string>;
  status?: string;
  customerId?: string;
}): NormalizedStripeEvent {
  return {
    id: "evt_1",
    type: overrides.type ?? "customer.subscription.created",
    subscription: {
      id: "sub_1",
      customerId: overrides.customerId ?? "cus_1",
      status: overrides.status ?? "active",
      cancelAtPeriodEnd: false,
      currentPeriodStart: 1_760_000_000,
      currentPeriodEnd: 1_762_600_000,
      metadata: overrides.metadata ?? { organization_id: "org-1", product_code: "estimate_quote_maker" },
    },
  };
}

function freshState(): FakeState {
  return { subscriptions: new Map(), entitlements: new Map(), auditActions: [] };
}

describe("processSubscriptionEvent", () => {
  it("upserts the subscription and activates the entitlement (§37.3 Scenario D core)", async () => {
    const state = freshState();
    const result = await processSubscriptionEvent(subscriptionEvent({}), createFakeStore(state));

    expect(result).toEqual({ outcome: "processed", organizationId: "org-1" });
    expect(state.subscriptions.get("sub_1")?.status).toBe("active");

    const entitlements = state.entitlements.get("org-1") ?? [];
    expect(entitlements.some((e) => e.featureCode === "estimate_quote_maker" && e.status === "active")).toBe(true);
    expect(entitlements.some((e) => e.featureCode === "job_tracker" && e.status === "active")).toBe(true);
    expect(state.auditActions).toContain("billing.subscription.active");
  });

  it("maps customer.subscription.deleted to canceled and suspends the entitlement", async () => {
    const state = freshState();
    const store = createFakeStore(state);
    await processSubscriptionEvent(subscriptionEvent({}), store);
    await processSubscriptionEvent(
      subscriptionEvent({ type: "customer.subscription.deleted", status: "active" }),
      store,
    );

    expect(state.subscriptions.get("sub_1")?.status).toBe("canceled");
    const entitlements = state.entitlements.get("org-1") ?? [];
    const feature = entitlements.find((e) => e.featureCode === "estimate_quote_maker");
    expect(feature?.status).toBe("suspended");
    // Job Tracker stays free regardless of billing (§13.1).
    expect(entitlements.find((e) => e.featureCode === "job_tracker")?.status).toBe("active");
  });

  it("resolves the organization by customer id when metadata is missing organization_id", async () => {
    const state = freshState();
    const store = createFakeStore(state);
    await processSubscriptionEvent(subscriptionEvent({}), store);

    const result = await processSubscriptionEvent(
      subscriptionEvent({
        type: "customer.subscription.updated",
        metadata: { product_code: "estimate_quote_maker" },
      }),
      store,
    );
    expect(result).toEqual({ outcome: "processed", organizationId: "org-1" });
  });

  it("throws non-retryable for an unattributable subscription", async () => {
    const state = freshState();
    await expect(
      processSubscriptionEvent(
        subscriptionEvent({ metadata: { product_code: "estimate_quote_maker" }, customerId: "cus_unknown" }),
        createFakeStore(state),
      ),
    ).rejects.toBeInstanceOf(NonRetryableWebhookError);
  });

  it("throws non-retryable for an unknown product code", async () => {
    const state = freshState();
    await expect(
      processSubscriptionEvent(
        subscriptionEvent({ metadata: { organization_id: "org-1", product_code: "mystery" } }),
        createFakeStore(state),
      ),
    ).rejects.toBeInstanceOf(NonRetryableWebhookError);
  });

  it("ignores unhandled event types", async () => {
    const state = freshState();
    const result = await processSubscriptionEvent(
      { id: "evt_2", type: "invoice.paid" },
      createFakeStore(state),
    );
    expect(result.outcome).toBe("ignored");
  });
});
