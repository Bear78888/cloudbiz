import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { renderEstimatePdf, type EstimatePdfInput } from "@/features/estimates/pdf";
import { getEstimateByToken } from "@/features/estimates/public-service";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isLocale } from "@/lib/routes";

export const dynamic = "force-dynamic";

/**
 * The customer's PDF download of an estimate (§16.9), alongside the same
 * token that opens the web page at `../page.tsx`. Same visibility rule as
 * that page, reusing the same lookup rather than a second one: a draft or a
 * withdrawn estimate is "gone" here exactly when it is there, because both
 * routes ask `getEstimateByToken` the same question instead of each
 * encoding their own copy of §16.8's status rules.
 *
 * Rate-limited the same as the page for the same reason: a token is the only
 * credential this route checks, and generating a PDF is not free.
 */

const PDF_RATE_LIMIT = 30;
const PDF_RATE_WINDOW_MS = 60_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; token: string }> },
) {
  const { locale, token } = await params;
  if (!isLocale(locale)) return new NextResponse("Not found", { status: 404 });

  const requestHeaders = await headers();
  const limit = rateLimit(
    `estimate-pdf:${clientKey(requestHeaders)}`,
    PDF_RATE_LIMIT,
    PDF_RATE_WINDOW_MS,
  );
  if (!limit.allowed) return new NextResponse("Too many requests", { status: 429 });

  const found = await getEstimateByToken(token);
  if (found.state !== "ok") return new NextResponse("Not found", { status: 404 });

  const estimate = found.estimate;
  const input: EstimatePdfInput = {
    locale: estimate.locale,
    businessName: estimate.businessName,
    currency: estimate.currency,
    title: estimate.title,
    scope: estimate.scope,
    terms: estimate.terms,
    items: estimate.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    subtotal: estimate.subtotal,
    tax: estimate.tax,
    taxRate: estimate.taxRate,
    total: estimate.total,
    sentAt: estimate.sentAt,
    expiresAt: estimate.expiresAt,
  };

  const pdf = await renderEstimatePdf(input);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="estimate-${estimate.id}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
