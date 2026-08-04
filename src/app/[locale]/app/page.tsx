import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { PRODUCTS } from "@/lib/config";
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
    title: `${dict.platform.dashboard.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/** Dashboard (§20): summary cards, tool states from entitlements, one next step. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const d = dict.platform.dashboard;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  // Layout guarantees membership; keep a guard for direct rendering edge cases.
  if (!membership) notFound();

  const { data: entitlementRows } = await supabase
    .from("entitlements")
    .select("feature_code, status")
    .eq("organization_id", membership.organizationId);
  const entitlements = entitlementRows ?? [];
  const isActive = (code: string) =>
    entitlements.some((e) => e.feature_code === code && e.status === "active");
  const hasPaid = PRODUCTS.some((p) => isActive(p.code));

  const summaryCards = [
    d.cards.newLeads,
    d.cards.estimatesWaiting,
    d.cards.jobsThisWeek,
    d.cards.unpaidJobs,
    d.cards.callsAnswered,
    d.cards.followUpsDue,
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{d.title}</h1>
        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
          {hasPaid ? d.planPaid : d.planFree}
        </span>
      </div>

      {/* Summary cards (§20.2) — live values arrive with the Job Tracker (Stage 2). */}
      <section aria-label={d.title}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((label) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-2xl font-bold text-slate-300">—</p>
              <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">{d.trackerTeaser}</p>
      </section>

      {/* Recommended next step (§20.4): exactly one. */}
      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-800">
          {d.nextStepTitle}
        </h2>
        <p className="mt-2 text-slate-800">{d.nextStepChooseTool}</p>
        <Link
          href={membership.role === "owner" ? `/${l}/app/billing` : `/${l === "es" ? "es/precios" : "en/pricing"}`}
          className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          {d.nextStepSeePricing}
        </Link>
      </section>

      {/* Tool states (§20.3). */}
      <section>
        <h2 className="text-lg font-bold text-slate-900">{d.toolsTitle}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => {
            const active = isActive(product.code);
            return (
              <li key={product.code} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">{dict.tools[product.code].name}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {active ? d.toolStates.active : d.toolStates.not_active}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{dict.tools[product.code].tagline}</p>
              </li>
            );
          })}
          <li className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-900">{dict.jobTracker.name}</p>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {d.comingSoon}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{d.trackerTeaser}</p>
          </li>
        </ul>
      </section>
    </div>
  );
}
