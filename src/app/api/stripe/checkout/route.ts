import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isBillableProductCode, type BillingInterval } from "@/features/billing/catalog";
import { CheckoutConfigurationError, createCheckoutSession } from "@/features/billing/checkout";
import { createStripeClient } from "@/features/billing/stripe";
import { getCurrentMembership } from "@/features/organizations/service";
import { checkServerEnvironment } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  product_code: z.string(),
  interval: z.enum(["month", "year"]).default("month"),
  locale: z.enum(["en", "es"]).default("en"),
});

/**
 * POST /api/stripe/checkout (§24). Owner-only (§11.3): staff cannot change
 * billing. Bundle/individual mixing is refused here until the Stage 9
 * proration flow exists — no double billing (§6.2.6).
 */
export async function POST(request: NextRequest) {
  if (!checkServerEnvironment("integrations").ok) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isBillableProductCode(parsed.data.product_code)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const productCode = parsed.data.product_code;
  const interval: BillingInterval = parsed.data.interval;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return NextResponse.json({ error: "organization_required" }, { status: 409 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "owner_role_required" }, { status: 403 });
  }

  // RLS lets the owner read their org's subscription cache.
  const { data: existingSubscriptions } = await supabase
    .from("subscriptions")
    .select("product_code, status, stripe_customer_id")
    .eq("organization_id", membership.organizationId)
    .in("status", ["active", "trialing", "past_due"]);
  const active = existingSubscriptions ?? [];

  if (active.some((s) => s.product_code === productCode)) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }
  const hasBundle = active.some((s) => s.product_code === "all_tools_bundle");
  const hasIndividual = active.some((s) => s.product_code !== "all_tools_bundle");
  if (hasBundle || (productCode === "all_tools_bundle" && hasIndividual)) {
    // Switching between individual tools and the bundle needs the guided
    // upgrade flow with a shown total (§6.2.7) — built in Stage 9.
    return NextResponse.json({ error: "upgrade_flow_required" }, { status: 409 });
  }

  const origin = request.nextUrl.origin;
  const base = `${origin}/${parsed.data.locale}/app/billing`;

  try {
    const stripe = createStripeClient();
    const { url } = await createCheckoutSession(stripe, {
      organizationId: membership.organizationId,
      productCode,
      interval,
      successUrl: `${base}?checkout=success`,
      cancelUrl: `${base}?checkout=canceled`,
      customerEmail: user.email ?? undefined,
      existingStripeCustomerId: active[0]?.stripe_customer_id ?? null,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof CheckoutConfigurationError) {
      console.error(`checkout configuration error: ${error.code}`);
      return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
    }
    console.error("checkout session creation failed");
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
