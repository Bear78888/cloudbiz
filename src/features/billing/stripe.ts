import "server-only";

import Stripe from "stripe";

import { getIntegrationEnvironment } from "@/lib/env/server";

export function createStripeClient(): Stripe {
  const environment = getIntegrationEnvironment();
  return new Stripe(environment.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret(): string | null {
  return getIntegrationEnvironment().STRIPE_WEBHOOK_SECRET ?? null;
}
