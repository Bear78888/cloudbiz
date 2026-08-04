"use client";

import { useParams } from "next/navigation";

import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/routes";

/**
 * Recoverable error state (§29): a plain apology and a retry button. No stack
 * trace, no database message, no exception name — those are for the logs.
 */
export default function JobsError({ reset }: { error: Error; reset: () => void }) {
  const params = useParams<{ locale: string }>();
  const locale = isLocale(params?.locale ?? "") ? params.locale : "en";
  const j = getDict(isLocale(locale) ? locale : "en").platform.jobs;

  return (
    <section
      role="alert"
      className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
    >
      <h1 className="text-xl font-bold text-slate-900">{j.errorTitle}</h1>
      <p className="mt-2 text-slate-700">{j.errorBody}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
      >
        {j.retry}
      </button>
    </section>
  );
}
