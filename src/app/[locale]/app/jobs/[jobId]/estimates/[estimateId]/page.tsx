import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  changeEstimateStatusAction,
  generateEstimateAction,
  sendEstimateAction,
} from "@/features/estimates/actions";
import { confidenceBand } from "@/features/ai/estimate-draft";
import { EstimateEditor } from "@/features/estimates/EstimateEditor";
import { isEditable, isReleased } from "@/features/estimates/model";
import { getEstimate } from "@/features/estimates/service";
import { getCurrentMembership } from "@/features/organizations/service";
import { resolveAppUrl } from "@/lib/app-url";
import { formatDate, formatMoney } from "@/lib/datetime";
import { fmt, getDict, type Dict } from "@/lib/i18n";
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
    title: `${dict.platform.estimates.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/** One button per legal move. Which moves are legal is decided server-side. */
function StatusButton({
  locale,
  jobId,
  estimateId,
  status,
  label,
  tone,
}: {
  locale: Locale;
  jobId: string;
  estimateId: string;
  status: string;
  label: string;
  tone: "primary" | "secondary";
}) {
  return (
    <form action={changeEstimateStatusAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="estimate_id" value={estimateId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={
          tone === "primary"
            ? "min-h-12 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
            : "min-h-12 rounded-xl border-2 border-slate-200 bg-white px-5 font-semibold text-slate-700 hover:border-slate-400"
        }
      >
        {label}
      </button>
    </form>
  );
}

/**
 * The address to hand a customer.
 *
 * Falls back to a relative path when the deployment address is unknown rather
 * than to a hardcoded domain: a wrong absolute link is worse than a short one
 * the owner has to prefix, because it silently points somewhere real.
 */
function customerLink(locale: Locale, token: string, appUrl: string | null): string {
  const path = `/e/${locale}/${token}`;
  return appUrl ? `${appUrl.replace(/\/$/, "")}${path}` : path;
}

function blockerMessage(dict: Dict, code: string | undefined): string | null {
  if (!code) return null;
  const blockers = dict.platform.estimates.blockers;
  return code in blockers ? blockers[code as keyof typeof blockers] : blockers.generic;
}

/**
 * The estimate screen (§16.4, §16.5).
 *
 * Editing and approving are on one page because they are one decision: the
 * owner reads the numbers and either fixes them or stands behind them. A draft
 * shows the editor; anything the customer has already seen shows the document
 * read-only, because changing it in place would rewrite what someone was asked
 * to agree to (§25.3).
 */
export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; jobId: string; estimateId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, jobId, estimateId } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const e = dict.platform.estimates;

  const query = await searchParams;
  const sentOk = query.sent === "1";
  const draftedOk = query.drafted === "1";
  const blockedParam = query.blocked;
  const blocked = blockerMessage(dict, Array.isArray(blockedParam) ? blockedParam[0] : blockedParam);

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();

  const estimate = await getEstimate(supabase, membership.organizationId, estimateId);
  if (!estimate || estimate.jobId !== jobId) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">{e.notFoundTitle}</h1>
        <p className="mt-2 text-slate-600">{e.notFoundBody}</p>
        <Link
          href={`/${l}/app/jobs/${jobId}`}
          className="mt-5 inline-block font-semibold text-brand-700 underline"
        >
          {e.backToJob}
        </Link>
      </section>
    );
  }

  const tz = membership.timezone;
  const currency = membership.currency;
  const released = isReleased(estimate.status);
  const appUrl = resolveAppUrl();
  const answered = estimate.status === "accepted" || estimate.status === "rejected";

  return (
    <div className="space-y-6">
      <Link
        href={`/${l}/app/jobs/${jobId}`}
        className="inline-block text-sm font-semibold text-brand-700 underline"
      >
        ← {e.backToJob}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {e.statuses[estimate.status]} · {fmt(e.versionLabel, { version: estimate.version })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{estimate.title}</h1>
          <p className="mt-1 text-slate-600">{formatDate(estimate.createdAt, l, tz)}</p>
        </div>
        <p className="text-2xl font-bold text-slate-900">
          {formatMoney(Number(estimate.total), l, currency)}
        </p>
      </div>

      {/* §16.9: a PDF of this exact estimate, any status including `draft` —
          proofing a document before Approve is not the thing §16.5 gates. */}
      <a
        href={`/${l}/app/jobs/${jobId}/estimates/${estimateId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-semibold text-brand-700 underline"
      >
        {e.pdfPreview}
      </a>

      {/* §16.4: the model's own confidence, in front of the owner *before*
          Approve. A low number is not a reason to hide the draft — it is a
          reason to read it closely, which nobody does if nobody says so. */}
      {estimate.aiConfidence !== null && isEditable(estimate.status) ? (
        <p
          className={
            confidenceBand(estimate.aiConfidence) === "low"
              ? "rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
              : "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
          }
        >
          {e.aiConfidenceLabel[confidenceBand(estimate.aiConfidence)]} {e.aiCheckBeforeApprove}
        </p>
      ) : null}

      {draftedOk ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {e.draftedNotice}
        </p>
      ) : null}

      {sentOk ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          {e.sentNotice}
        </p>
      ) : null}

      {blocked ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          {blocked}
        </p>
      ) : null}

      {/* §16.5: approval is a separate, deliberate act, and it is the only way
          to a status the customer can see. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {e.statusSection}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {estimate.status === "draft" ? (
            <StatusButton
              locale={l}
              jobId={jobId}
              estimateId={estimate.id}
              status="ready"
              label={e.approve}
              tone="primary"
            />
          ) : null}
          {estimate.status === "ready" ? (
            <>
              {/* §16.9: email is the main path now that we have a sender. The
                  manual mark stays for a customer with no email on file, or a
                  quote handed over on paper. */}
              <form action={sendEstimateAction}>
                <input type="hidden" name="locale" value={l} />
                <input type="hidden" name="job_id" value={jobId} />
                <input type="hidden" name="estimate_id" value={estimate.id} />
                <button
                  type="submit"
                  className="min-h-12 rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
                >
                  {e.sendByEmail}
                </button>
              </form>
              <StatusButton
                locale={l}
                jobId={jobId}
                estimateId={estimate.id}
                status="sent"
                label={e.markSent}
                tone="secondary"
              />
              <StatusButton
                locale={l}
                jobId={jobId}
                estimateId={estimate.id}
                status="draft"
                label={e.unapprove}
                tone="secondary"
              />
            </>
          ) : null}
          {estimate.status === "sent" || estimate.status === "viewed" ? (
            <>
              <StatusButton
                locale={l}
                jobId={jobId}
                estimateId={estimate.id}
                status="accepted"
                label={e.markAccepted}
                tone="primary"
              />
              <StatusButton
                locale={l}
                jobId={jobId}
                estimateId={estimate.id}
                status="rejected"
                label={e.markRejected}
                tone="secondary"
              />
              <StatusButton
                locale={l}
                jobId={jobId}
                estimateId={estimate.id}
                status="expired"
                label={e.markExpired}
                tone="secondary"
              />
            </>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {answered
            ? e.answeredNotice
            : released
              ? e.releasedNotice
              : estimate.status === "ready"
                ? `${e.approvedNotice} ${e.markSentHint}`
                : e.approveHint}
        </p>
      </section>

      {/* The link, once there is one. Shown only here, on a page behind the
          session — the token is a bearer credential, so the owner's screen is
          the one place it belongs. */}
      {estimate.publicToken ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {e.linkSection}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{e.linkHint}</p>
          <label htmlFor="customer-link" className="sr-only">
            {e.linkSection}
          </label>
          <input
            id="customer-link"
            readOnly
            value={customerLink(estimate.locale, estimate.publicToken, appUrl)}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800"
          />
          {estimate.expiresAt ? (
            <p className="mt-2 text-xs text-slate-500">
              {e.linkExpires} {formatDate(estimate.expiresAt, l, tz)}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* §16.2: describe the job, get a starting point. Only on something still
          editable — regenerating a sent document would rewrite what a customer
          was asked to agree to. */}
      {isEditable(estimate.status) ? (
        <form
          action={generateEstimateAction}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <input type="hidden" name="locale" value={l} />
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="estimate_id" value={estimate.id} />
          <input type="hidden" name="tax_rate" value={estimate.taxRate} />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {e.aiSection}
          </h2>
          <label htmlFor="ai_description" className="mt-3 block text-sm text-slate-600">
            {e.aiDescriptionLabel}
          </label>
          <textarea
            id="ai_description"
            name="description"
            rows={3}
            maxLength={4000}
            placeholder={e.aiDescriptionPlaceholder}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="min-h-12 rounded-xl border-2 border-brand-200 bg-white px-5 font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-50"
            >
              {e.aiDraftButton}
            </button>
            <span className="text-xs text-slate-500">{e.aiReplacesLines}</span>
          </div>
        </form>
      ) : null}

      {/* Not `!released`: an expired estimate was never released and is still
          not editable — nothing leads out of `expired` (§25.3). */}
      {!isEditable(estimate.status) ? (
        <ReadOnlyEstimate estimate={estimate} dict={dict} locale={l} currency={currency} />
      ) : (
        <EstimateEditor
          locale={l}
          dict={dict}
          currency={currency}
          estimate={estimate}
          jobId={jobId}
        />
      )}
    </div>
  );
}

/** What the customer was sent, exactly as it was priced. */
function ReadOnlyEstimate({
  estimate,
  dict,
  locale,
  currency,
}: {
  estimate: NonNullable<Awaited<ReturnType<typeof getEstimate>>>;
  dict: Dict;
  locale: Locale;
  currency: string;
}) {
  const e = dict.platform.estimates;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      {estimate.scope ? (
        <p className="mb-4 whitespace-pre-wrap text-slate-700">{estimate.scope}</p>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {estimate.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span className="text-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {e.itemTypes[item.itemType]}
              </span>{" "}
              {item.description}
              {item.quantity !== 1 ? (
                <span className="text-slate-500">
                  {" "}
                  × {item.quantity} @ {formatMoney(item.unitPrice, locale, currency)}
                </span>
              ) : null}
            </span>
            <span className="font-medium text-slate-900">
              {formatMoney(item.total, locale, currency)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 border-t border-slate-200 pt-3">
        <div className="flex justify-between py-1">
          <dt className="text-slate-600">{e.subtotal}</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(Number(estimate.subtotal), locale, currency)}
          </dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-slate-600">
            {e.tax}
            {estimate.taxRate > 0 ? ` (${Math.round(estimate.taxRate * 10000) / 100}%)` : ""}
          </dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(Number(estimate.tax), locale, currency)}
          </dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-2">
          <dt className="font-bold text-slate-900">{e.total}</dt>
          <dd className="text-lg font-bold text-slate-900">
            {formatMoney(Number(estimate.total), locale, currency)}
          </dd>
        </div>
      </dl>

      {estimate.terms ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{e.termsField}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{estimate.terms}</p>
        </div>
      ) : null}
    </section>
  );
}
