import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillableProductCode } from "@/features/billing/catalog";
import type { ResolvedEntitlement, SubscriptionStatus } from "@/features/entitlements/logic";
import type {
  BillingStore,
  EventAdmission,
  SubscriptionUpsert,
  WebhookEventInput,
} from "@/features/billing/store";

/**
 * Supabase-backed BillingStore. Uses the service-role client: webhook
 * processing runs outside any user session, and RLS on billing tables
 * deliberately has no write policies. Every method stays scoped to the
 * explicit organization_id it is given.
 */
export function createSupabaseBillingStore(
  client: SupabaseClient = createSupabaseAdminClient(),
): BillingStore {
  return {
    async admitWebhookEvent(event: WebhookEventInput): Promise<EventAdmission> {
      const insert = await client.from("webhook_events").insert({
        provider: event.provider,
        external_event_id: event.externalEventId,
        event_type: event.eventType,
        signature_verified: event.signatureVerified,
        payload_hash: event.payloadHash,
        sanitized_payload: event.sanitizedPayload,
        processing_status: "processing",
        attempt_count: 1,
      });

      if (!insert.error) return { kind: "new" };
      if (insert.error.code !== "23505") {
        throw new Error(`webhook_events insert failed: ${insert.error.code}`);
      }

      // Unique violation → the event exists. Failed events are retried.
      const existing = await client
        .from("webhook_events")
        .select("processing_status, attempt_count")
        .eq("provider", event.provider)
        .eq("external_event_id", event.externalEventId)
        .single();
      if (existing.error) {
        throw new Error(`webhook_events lookup failed: ${existing.error.code}`);
      }
      if (existing.data.processing_status === "failed") {
        await client
          .from("webhook_events")
          .update({
            processing_status: "processing",
            attempt_count: Math.min(existing.data.attempt_count + 1, 20),
          })
          .eq("provider", event.provider)
          .eq("external_event_id", event.externalEventId);
        return { kind: "retry" };
      }
      return { kind: "duplicate" };
    },

    async markWebhookEventProcessed(provider, externalEventId): Promise<void> {
      await client
        .from("webhook_events")
        .update({ processing_status: "processed", processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("external_event_id", externalEventId);
    },

    async markWebhookEventFailed(provider, externalEventId, errorCode): Promise<void> {
      await client
        .from("webhook_events")
        .update({ processing_status: "failed", error_code: errorCode.slice(0, 120) })
        .eq("provider", provider)
        .eq("external_event_id", externalEventId);
    },

    async upsertSubscription(subscription: SubscriptionUpsert): Promise<void> {
      const { error } = await client.from("subscriptions").upsert(
        {
          organization_id: subscription.organizationId,
          stripe_customer_id: subscription.stripeCustomerId,
          stripe_subscription_id: subscription.stripeSubscriptionId,
          product_code: subscription.productCode,
          status: subscription.status,
          current_period_start: subscription.currentPeriodStart,
          current_period_end: subscription.currentPeriodEnd,
          cancel_at_period_end: subscription.cancelAtPeriodEnd,
        },
        { onConflict: "stripe_subscription_id" },
      );
      if (error) throw new Error(`subscriptions upsert failed: ${error.code}`);
    },

    async listOrganizationSubscriptions(organizationId: string) {
      const { data, error } = await client
        .from("subscriptions")
        .select("product_code, status, current_period_end")
        .eq("organization_id", organizationId);
      if (error) throw new Error(`subscriptions list failed: ${error.code}`);
      return (data ?? []).map((row) => ({
        productCode: row.product_code as BillableProductCode,
        status: row.status as SubscriptionStatus,
        currentPeriodEnd: row.current_period_end as string | null,
      }));
    },

    async findOrganizationIdByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
      const { data, error } = await client
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`customer lookup failed: ${error.code}`);
      return data?.organization_id ?? null;
    },

    async replaceEntitlements(
      organizationId: string,
      entitlements: readonly ResolvedEntitlement[],
    ): Promise<void> {
      // Upsert per feature; entitlements not in the resolved set are revoked,
      // except job_tracker which resolveEntitlements always includes (§13.1).
      const rows = entitlements.map((e) => ({
        organization_id: organizationId,
        feature_code: e.featureCode,
        status: e.status,
        limits: e.limits,
        valid_until: e.validUntil,
      }));
      const upsert = await client
        .from("entitlements")
        .upsert(rows, { onConflict: "organization_id,feature_code" });
      if (upsert.error) throw new Error(`entitlements upsert failed: ${upsert.error.code}`);

      const keep = entitlements.map((e) => e.featureCode);
      const revoke = await client
        .from("entitlements")
        .update({ status: "revoked" })
        .eq("organization_id", organizationId)
        .not("feature_code", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
      if (revoke.error) throw new Error(`entitlements revoke failed: ${revoke.error.code}`);
    },

    async appendAuditLog(entry): Promise<void> {
      const { error } = await client.from("audit_logs").insert({
        organization_id: entry.organizationId,
        actor_type: "webhook",
        actor_id: null,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        after_data: entry.afterData,
      });
      if (error) throw new Error(`audit log insert failed: ${error.code}`);
    },
  };
}
