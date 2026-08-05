"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isLocale, type Locale } from "@/lib/routes";

import { answerEstimateByToken } from "./public-service";

/**
 * The customer's answer, from the public link (§16.5).
 *
 * Everything this action trusts comes from the token, which it re-checks.
 * The form's other fields decide only where the visitor is sent afterwards —
 * nothing about which estimate is written, or whether it may be.
 *
 * Answering is rate-limited harder than reading: a person opens an estimate a
 * few times and answers once.
 */

const ANSWER_RATE_LIMIT = 8;
const ANSWER_RATE_WINDOW_MS = 60_000;

export async function answerEstimateAction(formData: FormData): Promise<void> {
  const localeRaw = String(formData.get("locale") ?? "en");
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "en";
  const token = String(formData.get("token") ?? "").trim();
  const answerRaw = String(formData.get("answer") ?? "").trim();

  // The registry, positively: only these two words are an answer.
  if (answerRaw !== "accepted" && answerRaw !== "rejected") {
    redirect(`/${locale}/e/${token}`);
  }

  const requestHeaders = await headers();
  const limit = rateLimit(
    `estimate-answer:${clientKey(requestHeaders)}`,
    ANSWER_RATE_LIMIT,
    ANSWER_RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    console.warn("[public-estimate] answer rate limit reached");
    redirect(`/${locale}/e/${token}?answered=slow`);
  }

  const result = await answerEstimateByToken(token, answerRaw);

  // The outcome travels in the URL rather than in a session: this visitor has
  // no account and no session to put it in, and a query parameter survives the
  // redirect without inventing one.
  if (!result.ok && result.reason === "already_answered") {
    redirect(`/${locale}/e/${token}?answered=already`);
  }

  redirect(`/${locale}/e/${token}`);
}
