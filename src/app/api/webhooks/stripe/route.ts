import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { createStripeClient, getStripeWebhookSecret } from "@/features/billing/stripe";
import { createSupabaseBillingStore } from "@/features/billing/supabase-store";
import {
  isHandledEventType,
  NonRetryableWebhookError,
  processSubscriptionEvent,
  type NormalizedStripeEvent,
} from "@/features/billing/webhook";
import { checkServerEnvironment } from "@/lib/env/server";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe (§24, §26.4): verify signature on the raw body,
 * admit through webhook_events (idempotent), process, answer fast.
 * Retryable failure → 500 (Stripe retries); non-retryable → recorded + 200
 * so a poison event can never loop forever.
 */

function toStringRecord(metadata: Stripe.Metadata | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Since the Basil API family, current_period_* live on subscription items.
 * The subscription-level fields are read as a fallback for older payloads.
 */
function extractPeriod(subscription: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  let start: number | null = null;
  let end: number | null = null;
  for (const item of subscription.items?.data ?? []) {
    if (typeof item.current_period_start === "number") {
      start = start === null ? item.current_period_start : Math.min(start, item.current_period_start);
    }
    if (typeof item.current_period_end === "number") {
      end = end === null ? item.current_period_end : Math.max(end, item.current_period_end);
    }
  }
  const legacy = subscription as unknown as Record<string, unknown>;
  if (start === null && typeof legacy.current_period_start === "number") {
    start = legacy.current_period_start;
  }
  if (end === null && typeof legacy.current_period_end === "number") {
    end = legacy.current_period_end;
  }
  return { start, end };
}

function normalizeEvent(event: Stripe.Event): NormalizedStripeEvent {
  const normalized: NormalizedStripeEvent = { id: event.id, type: event.type };
  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const period = extractPeriod(subscription);
    normalized.subscription = {
      id: subscription.id,
      customerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      metadata: toStringRecord(subscription.metadata),
    };
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  if (!checkServerEnvironment("integrations").ok) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    // Fail closed: without the signing secret nothing can be verified.
    return NextResponse.json({ error: "webhook_secret_missing" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "signature_missing" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = createStripeClient();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "signature_invalid" }, { status: 400 });
  }

  if (!isHandledEventType(event.type)) {
    // Acknowledge everything we do not process — no webhook_events row needed.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const store = createSupabaseBillingStore();
  const normalized = normalizeEvent(event);
  const admission = await store.admitWebhookEvent({
    provider: "stripe",
    externalEventId: event.id,
    eventType: event.type,
    signatureVerified: true,
    payloadHash: createHash("sha256").update(rawBody).digest("hex"),
    sanitizedPayload: {
      subscription_id: normalized.subscription?.id ?? null,
      customer_id: normalized.subscription?.customerId ?? null,
      status: normalized.subscription?.status ?? null,
    },
  });
  if (admission.kind === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const result = await processSubscriptionEvent(normalized, store);
    await store.markWebhookEventProcessed("stripe", event.id);
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (error) {
    if (error instanceof NonRetryableWebhookError) {
      await store.markWebhookEventFailed("stripe", event.id, error.code);
      // 200: Stripe must not retry an event we can never process.
      return NextResponse.json({ received: true, outcome: "failed_non_retryable" });
    }
    await store.markWebhookEventFailed("stripe", event.id, "retryable_error");
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
