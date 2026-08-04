import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BillingTools } from "@/features/billing/BillingTools";
import { getCurrentMembership } from "@/features/organizations/service";
import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDict(locale);
  return {
    title: `${dict.platform.billing.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/** Billing (§6): subscribe per tool or bundle; owner-only (§11.3). */
export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/${l}/app`);

  const { data: subscriptionRows } = await supabase
    .from("subscriptions")
    .select("product_code, status")
    .eq("organization_id", membership.organizationId)
    .in("status", ["active", "trialing", "past_due"]);
  const activeCodes = (subscriptionRows ?? []).map((s) => s.product_code as string);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.platform.billing.title}</h1>
        <p className="mt-1 text-slate-600">{dict.platform.billing.sub}</p>
      </div>
      <BillingTools locale={l} dict={dict} activeProductCodes={activeCodes} />
    </div>
  );
}
