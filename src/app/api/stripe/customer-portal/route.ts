import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createStripeClient } from "@/features/billing/stripe";
import { getCurrentMembership } from "@/features/organizations/service";
import { checkServerEnvironment } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/query";

export const runtime = "nodejs";

const bodySchema = z.object({ locale: z.enum(["en", "es"]).default("en") });

/** POST /api/stripe/customer-portal (§24). Owner-only. */
export async function POST(request: NextRequest) {
  if (!checkServerEnvironment("integrations").ok) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const locale = parsed.success ? parsed.data.locale : "en";

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

  const subscription = await must(
    supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", membership.organizationId)
    .limit(1)
    .maybeSingle(),
    "route:subscription",
  );
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "no_billing_account" }, { status: 404 });
  }

  try {
    const stripe = createStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/${locale}/app/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    console.error("customer portal session creation failed");
    return NextResponse.json({ error: "portal_failed" }, { status: 502 });
  }
}
