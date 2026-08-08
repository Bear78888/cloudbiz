import { NextResponse } from "next/server";

import { renderEstimatePdf, type EstimatePdfInput } from "@/features/estimates/pdf";
import { getEstimate } from "@/features/estimates/service";
import { getCurrentMembership } from "@/features/organizations/service";
import { isLocale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The owner's own PDF of an estimate (§16.9) — any status, including `draft`.
 *
 * Unlike the customer-facing route below, there is no "may this be seen"
 * question here: an owner looking at their own estimate is not the audience
 * §16.5's approval gate exists for. What still applies is org scoping —
 * `getEstimate` takes `organizationId` from the caller's own membership, not
 * from anything in the URL, so one org's estimate id cannot be walked into
 * another's PDF by guessing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; jobId: string; estimateId: string }> },
) {
  const { locale, estimateId } = await params;
  if (!isLocale(locale)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) return new NextResponse("Not found", { status: 404 });

  const estimate = await getEstimate(supabase, membership.organizationId, estimateId);
  if (!estimate) return new NextResponse("Not found", { status: 404 });

  const input: EstimatePdfInput = {
    locale: estimate.locale,
    businessName: membership.organizationName,
    currency: membership.currency,
    title: estimate.title,
    scope: estimate.scope,
    terms: estimate.terms,
    items: estimate.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    subtotal: Number(estimate.subtotal),
    tax: Number(estimate.tax),
    taxRate: estimate.taxRate,
    total: Number(estimate.total),
    sentAt: estimate.sentAt,
    expiresAt: estimate.expiresAt,
  };

  const pdf = await renderEstimatePdf(input);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="estimate-${estimate.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
