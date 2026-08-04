import "server-only";

import type Stripe from "stripe";

import {
  findCatalogEntry,
  type BillableProductCode,
  type BillingInterval,
} from "@/features/billing/catalog";

/**
 * Checkout session creation (§6.2). The Price is found by lookup_key and its
 * amount re-verified against the catalog (audit §4.2): a mismatch is a
 * configuration error and aborts — we never charge an unexpected amount.
 */

export class CheckoutConfigurationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutConfigurationError";
  }
}

export interface CheckoutRequest {
  organizationId: string;
  productCode: BillableProductCode;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  existingStripeCustomerId?: string | null;
}

export async function createCheckoutSession(
  stripe: Stripe,
  request: CheckoutRequest,
): Promise<{ url: string }> {
  const entry = findCatalogEntry(request.productCode, request.interval);
  if (!entry) {
    throw new CheckoutConfigurationError(
      "unknown_product",
      `No catalog entry for ${request.productCode}/${request.interval}`,
    );
  }

  const prices = await stripe.prices.list({
    lookup_keys: [entry.lookupKey],
    expand: ["data.product"],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new CheckoutConfigurationError(
      "price_not_provisioned",
      `Stripe price with lookup_key ${entry.lookupKey} does not exist`,
    );
  }
  if (
    price.unit_amount !== entry.expectedUnitAmount ||
    price.currency !== entry.currency ||
    price.recurring?.interval !== entry.interval
  ) {
    throw new CheckoutConfigurationError(
      "price_mismatch",
      `Stripe price ${price.id} does not match the catalog for ${entry.lookupKey}`,
    );
  }

  const metadata = {
    app: "handyalliance",
    organization_id: request.organizationId,
    product_code: request.productCode,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: request.organizationId,
    ...(request.existingStripeCustomerId
      ? { customer: request.existingStripeCustomerId }
      : { customer_email: request.customerEmail }),
    metadata,
    subscription_data: { metadata },
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
  });

  if (!session.url) {
    throw new CheckoutConfigurationError("no_session_url", "Stripe returned no Checkout URL");
  }
  return { url: session.url };
}
