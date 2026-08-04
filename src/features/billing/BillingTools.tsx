"use client";

import { useState } from "react";

import { fmt } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n";
import { PRICING, PRODUCTS } from "@/lib/config";
import type { Locale } from "@/lib/routes";

/**
 * Tool subscription cards (§6). Prices come from configuration (§6.2.1);
 * the server re-verifies them against Stripe before Checkout. Limits are
 * visible before purchase (§6.2.10) via the tool taglines and pricing page.
 */
export function BillingTools({
  locale,
  dict,
  activeProductCodes,
}: {
  locale: Locale;
  dict: Dict;
  activeProductCodes: readonly string[];
}) {
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = dict.platform.billing;

  async function startCheckout(productCode: string, interval: "month" | "year") {
    setPendingCode(productCode);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_code: productCode, interval, locale }),
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.ok && payload.url) {
        window.location.assign(payload.url);
        return;
      }
      if (payload.error === "billing_not_configured") setError(b.notConfigured);
      else if (payload.error === "already_subscribed") setError(b.alreadySubscribed);
      else if (payload.error === "upgrade_flow_required") setError(b.upgradeFlowRequired);
      else setError(b.errorGeneric);
    } catch {
      setError(b.errorGeneric);
    } finally {
      setPendingCode(null);
    }
  }

  async function openPortal() {
    setPendingCode("portal");
    setError(null);
    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.ok && payload.url) {
        window.location.assign(payload.url);
        return;
      }
      setError(payload.error === "billing_not_configured" ? b.notConfigured : b.errorGeneric);
    } catch {
      setError(b.errorGeneric);
    } finally {
      setPendingCode(null);
    }
  }

  const hasAnySubscription = activeProductCodes.length > 0;
  const bundleActive = activeProductCodes.includes("all_tools_bundle");

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Free Job Tracker card first (§13). */}
        <li className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-slate-900">{dict.jobTracker.name}</p>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {b.includedFree}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{dict.jobTracker.tagline}</p>
        </li>

        {PRODUCTS.map((product) => {
          const active = bundleActive || activeProductCodes.includes(product.code);
          const price = PRICING[product.code];
          return (
            <li key={product.code} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{dict.tools[product.code].name}</p>
                {active ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {b.subscribed}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                ${price.monthly}
                {dict.common.perMonth}
              </p>
              <p className="mt-2 text-sm text-slate-600">{dict.tools[product.code].tagline}</p>
              {!active ? (
                <button
                  type="button"
                  disabled={pendingCode !== null}
                  onClick={() => startCheckout(product.code, "month")}
                  className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
                >
                  {pendingCode === product.code ? b.redirecting : b.subscribe}
                </button>
              ) : null}
            </li>
          );
        })}

        {/* Bundle card (§6.1). */}
        <li className="rounded-2xl border-2 border-brand-300 bg-brand-50/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-slate-900">{dict.pricingPage.bundle.name}</p>
            {bundleActive ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {b.subscribed}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {fmt(dict.pricingPage.bundle.priceLine, { price: PRICING.all_tools_bundle.monthly })}
          </p>
          <p className="mt-2 text-sm text-slate-600">{dict.pricingPage.bundle.blurb}</p>
          {!bundleActive ? (
            <button
              type="button"
              disabled={pendingCode !== null}
              onClick={() => startCheckout("all_tools_bundle", "month")}
              className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
            >
              {pendingCode === "all_tools_bundle" ? b.redirecting : dict.pricingPage.bundle.cta}
            </button>
          ) : null}
        </li>
      </ul>

      {hasAnySubscription ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <button
            type="button"
            disabled={pendingCode !== null}
            onClick={openPortal}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait"
          >
            {pendingCode === "portal" ? b.redirecting : b.manage}
          </button>
          <p className="mt-2 text-sm text-slate-500">{b.manageHint}</p>
        </div>
      ) : null}
    </div>
  );
}
