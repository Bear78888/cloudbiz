import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { answerEstimateAction } from "@/features/estimates/public-actions";
import {
  getEstimateByToken,
  markEstimateViewed,
  type PublicEstimate,
} from "@/features/estimates/public-service";
import { formatDate, formatMoney } from "@/lib/datetime";
import { getDict, type Dict } from "@/lib/i18n";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isLocale, type Locale } from "@/lib/routes";

/**
 * The customer's copy of an estimate (§16).
 *
 * The first surface of this product a stranger can reach, so the rules are
 * stricter than anywhere else in the app:
 *
 *  - `noindex, nofollow`, and the token is in the path, so it must never end up
 *    in a search result. Nothing here is meant to be found — only opened by
 *    someone who was sent the link.
 *  - The page shows the estimate and who it is from. Not the customer's phone,
 *    email or address, not the job, not the notes, not a hint that any other
 *    customer exists. That is enforced by the column allow-list the queries are
 *    written from, not by remembering not to render something.
 *  - A wrong token and a withdrawn one are the same 404, because withdrawal
 *    deletes the token rather than marking it unusable.
 */

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  // Deliberately no title from the estimate: a link preview in a group chat
  // should not spell out what someone is having repaired, or for how much.
  return { title: "Estimate", robots: { index: false, follow: false } };
}

/** Generous for a person reading a document, tight enough to stop a script. */
const LINK_RATE_LIMIT = 30;
const LINK_RATE_WINDOW_MS = 60_000;

function Money({
  amount,
  locale,
  currency,
}: {
  amount: number;
  locale: Locale;
  currency: string;
}) {
  return <>{formatMoney(amount, locale, currency)}</>;
}

export default async function PublicEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const p = dict.platform.publicEstimate;

  const requestHeaders = await headers();
  const limit = rateLimit(
    `estimate-link:${clientKey(requestHeaders)}`,
    LINK_RATE_LIMIT,
    LINK_RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return (
      <Shell dict={dict}>
        <h1 className="text-xl font-bold text-slate-900">{p.slowDownTitle}</h1>
        <p className="mt-2 text-slate-600">{p.slowDownBody}</p>
      </Shell>
    );
  }

  const found = await getEstimateByToken(token);

  if (found.state === "expired") {
    return (
      <Shell dict={dict}>
        <h1 className="text-xl font-bold text-slate-900">{p.expiredTitle}</h1>
        <p className="mt-2 text-slate-600">
          {found.businessName ? `${p.expiredBody} ${found.businessName}.` : p.expiredBody}
        </p>
      </Shell>
    );
  }

  const estimate: PublicEstimate | null = found.state === "ok" ? found.estimate : null;
  if (!estimate) {
    // Logged so a burst of these is visible; the token itself is never written
    // to a log — it is a credential, and logs travel.
    console.warn("[public-estimate] no estimate for a presented link");
    notFound();
  }

  // Opening it is what `viewed` means (§16.8). Bots that unfurl links in chat
  // apps would otherwise tell the owner their customer read it — best effort,
  // and wrong in the harmless direction if a user agent lies.
  const userAgent = requestHeaders.get("user-agent") ?? "";
  if (!looksLikeLinkPreview(userAgent)) {
    await markEstimateViewed(estimate.id, estimate.status);
  }

  const answered = await searchParams.then((s) => s.answered);

  return (
    <Shell dict={dict}>
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {estimate.businessName}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{estimate.title}</h1>
      {estimate.sentAt ? (
        <p className="mt-1 text-sm text-slate-600">{formatDate(estimate.sentAt, l, "UTC")}</p>
      ) : null}

      {estimate.status === "accepted" ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-900"
        >
          {p.acceptedNotice}
        </p>
      ) : null}
      {estimate.status === "rejected" ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 font-medium text-slate-800"
        >
          {p.rejectedNotice}
        </p>
      ) : null}
      {answered === "already" ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-medium text-amber-900"
        >
          {p.alreadyAnswered}
        </p>
      ) : null}

      {estimate.scope ? (
        <p className="mt-5 whitespace-pre-wrap text-slate-700">{estimate.scope}</p>
      ) : null}

      <ul className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
        {estimate.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <span className="text-slate-800">
              {item.description}
              {item.quantity !== 1 ? (
                <span className="text-slate-500">
                  {" "}
                  × {item.quantity} @{" "}
                  <Money amount={item.unitPrice} locale={l} currency={estimate.currency} />
                </span>
              ) : null}
            </span>
            <span className="font-medium text-slate-900">
              <Money amount={item.total} locale={l} currency={estimate.currency} />
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4">
        <div className="flex justify-between py-1">
          <dt className="text-slate-600">{p.subtotal}</dt>
          <dd className="font-medium text-slate-900">
            <Money amount={estimate.subtotal} locale={l} currency={estimate.currency} />
          </dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-slate-600">
            {p.tax}
            {estimate.taxRate > 0 ? ` (${Math.round(estimate.taxRate * 10000) / 100}%)` : ""}
          </dt>
          <dd className="font-medium text-slate-900">
            <Money amount={estimate.tax} locale={l} currency={estimate.currency} />
          </dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-3">
          <dt className="text-lg font-bold text-slate-900">{p.total}</dt>
          <dd className="text-2xl font-bold text-slate-900">
            <Money amount={estimate.total} locale={l} currency={estimate.currency} />
          </dd>
        </div>
      </dl>

      {estimate.terms ? (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.terms}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{estimate.terms}</p>
        </div>
      ) : null}

      {estimate.canAnswer ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600">{p.answerPrompt}</p>
          <div className="flex flex-wrap gap-3">
            <AnswerButton token={token} locale={l} answer="accepted" label={p.accept} primary />
            <AnswerButton token={token} locale={l} answer="rejected" label={p.decline} />
          </div>
          {estimate.expiresAt ? (
            <p className="text-xs text-slate-500">
              {p.goodUntil} {formatDate(estimate.expiresAt, l, "UTC")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}

function AnswerButton({
  token,
  locale,
  answer,
  label,
  primary,
}: {
  token: string;
  locale: Locale;
  answer: "accepted" | "rejected";
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={answerEstimateAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="answer" value={answer} />
      <button
        type="submit"
        className={
          primary
            ? "min-h-12 rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
            : "min-h-12 rounded-xl border-2 border-slate-200 bg-white px-6 font-semibold text-slate-700 hover:border-slate-400"
        }
      >
        {label}
      </button>
    </form>
  );
}

/**
 * User agents that fetch a link to build a preview card rather than to read it.
 *
 * Best effort by design: a bot that does not say so still marks the estimate
 * viewed, which is a small lie to the owner rather than anything a customer
 * sees. Blocking on certainty here would mean not recording views at all.
 */
function looksLikeLinkPreview(userAgent: string): boolean {
  return /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|telegram|discord|twitterbot|linkedinbot|embedly|skypeuripreview/i.test(
    userAgent,
  );
}

/** Standalone frame: this page is outside the app shell and its navigation. */
function Shell({ dict, children }: { dict: Dict; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-slate-500">{dict.meta.siteName}</p>
    </main>
  );
}
