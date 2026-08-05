import "server-only";

import { must } from "@/lib/supabase/query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  PUBLIC_ESTIMATE_SELECT,
  PUBLIC_ITEM_SELECT,
  PUBLIC_ORGANIZATION_SELECT,
  canCustomerAnswer,
  isWellFormedToken,
  linkState,
  type LinkState,
} from "./public-link";
import type { EstimateItemType, EstimateStatus } from "./model";

/**
 * Reads and writes behind the customer-facing link (§16).
 *
 * These use the service-role client, because `anon` holds no grant on any
 * estimate table and deliberately never will: a token is a bearer credential,
 * and checking one belongs in code that can rate-limit, log and decide what to
 * return — not in a row filter that PostgREST will happily let anyone probe.
 *
 * The price of that is that RLS is not helping here, so every query in this
 * file names its columns from the allow-list in `public-link.ts` and every one
 * is scoped by the token. Nothing in this module takes an organization id from
 * a caller.
 */

export interface PublicEstimateItem {
  id: string;
  itemType: EstimateItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PublicEstimate {
  id: string;
  status: EstimateStatus;
  locale: "en" | "es";
  title: string;
  scope: string | null;
  terms: string | null;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  sentAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  businessName: string;
  currency: string;
  canAnswer: boolean;
  items: PublicEstimateItem[];
}

export type PublicEstimateResult =
  | { state: "ok"; estimate: PublicEstimate }
  | { state: Exclude<LinkState, "ok">; businessName: string | null };

/**
 * Looks up the estimate a token points at.
 *
 * The shape check runs first so a scanner throwing paths at the route never
 * reaches the database.
 */
export async function getEstimateByToken(
  token: string,
  now = new Date(),
): Promise<PublicEstimateResult> {
  if (!isWellFormedToken(token)) return { state: "gone", businessName: null };

  const supabase = createSupabaseAdminClient();

  const row = await must(
    supabase
      .from("estimates")
      .select(PUBLIC_ESTIMATE_SELECT)
      .eq("public_token", token)
      .maybeSingle(),
    "public-estimate:by-token",
  );

  const state = linkState(
    row ? { status: row.status as EstimateStatus, expiresAt: row.expires_at } : null,
    now,
  );

  if (state !== "ok" || !row) {
    // An expired estimate still says who it was from, so the customer knows who
    // to call. A token that matches nothing says nothing at all — there is no
    // business to name, and inventing one would be a hint.
    if (state === "expired" && row) {
      const org = await must(
        supabase
          .from("organizations")
          .select(PUBLIC_ORGANIZATION_SELECT)
          .eq("id", row.organization_id)
          .maybeSingle(),
        "public-estimate:organization-expired",
      );
      return { state, businessName: org?.name ?? null };
    }
    return { state: state === "ok" ? "gone" : state, businessName: null };
  }

  const [org, items] = await Promise.all([
    must(
      supabase
        .from("organizations")
        .select(PUBLIC_ORGANIZATION_SELECT)
        .eq("id", row.organization_id)
        .maybeSingle(),
      "public-estimate:organization",
    ),
    must(
      supabase
        .from("estimate_items")
        .select(PUBLIC_ITEM_SELECT)
        .eq("estimate_id", row.id)
        .order("sort_order", { ascending: true }),
      "public-estimate:items",
    ),
  ]);

  const status = row.status as EstimateStatus;

  return {
    state: "ok",
    estimate: {
      id: row.id,
      status,
      locale: row.locale as "en" | "es",
      title: row.title,
      scope: row.scope,
      terms: row.terms,
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      taxRate: Number(row.tax_rate),
      total: Number(row.total),
      sentAt: row.sent_at,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      rejectedAt: row.rejected_at,
      businessName: org?.name ?? "",
      currency: org?.currency ?? "usd",
      canAnswer: canCustomerAnswer(status),
      items: (items ?? []).map((item) => ({
        id: item.id,
        itemType: item.item_type as EstimateItemType,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
      })),
    },
  };
}

/**
 * Records that the customer opened it (§16.8 `viewed`).
 *
 * Only ever `sent` → `viewed`, and only once: a second visit must not restamp
 * the date, or "first opened" stops meaning that. Failure is swallowed on
 * purpose — the customer came to read an estimate, and a bookkeeping write
 * failing is not a reason to show them an error page.
 */
export async function markEstimateViewed(estimateId: string, status: EstimateStatus): Promise<void> {
  if (status !== "sent") return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("estimates")
    .update({ status: "viewed", viewed_at: new Date().toISOString() })
    .eq("id", estimateId)
    .eq("status", "sent");

  if (error) console.error("[public-estimate] could not record the view:", error.message);
}

/**
 * The customer's answer (§16.5).
 *
 * Re-checks the token rather than trusting an id from the form: the page that
 * rendered the button is not evidence of anything by the time a POST arrives.
 * The status guard in the `where` clause means two clicks, or a click racing a
 * withdrawal, cannot overwrite an answer that already landed.
 */
export async function answerEstimateByToken(
  token: string,
  answer: "accepted" | "rejected",
  now = new Date(),
): Promise<{ ok: true } | { ok: false; reason: LinkState | "already_answered" }> {
  const found = await getEstimateByToken(token, now);
  if (found.state !== "ok") return { ok: false, reason: found.state };
  if (!found.estimate.canAnswer) return { ok: false, reason: "already_answered" };

  const supabase = createSupabaseAdminClient();

  // Written as a branch rather than a computed key: a `[stamp]:` property is
  // typed as an arbitrary string by the generated client, which turns off the
  // very column checking this file relies on in place of RLS.
  const patch =
    answer === "accepted"
      ? { status: "accepted", accepted_at: now.toISOString() }
      : { status: "rejected", rejected_at: now.toISOString() };

  const { data, error } = await supabase
    .from("estimates")
    .update(patch)
    .eq("public_token", token)
    .in("status", ["sent", "viewed"])
    .select("id, organization_id, job_id, total");

  if (error) return { ok: false, reason: "gone" };
  if (!data || data.length === 0) return { ok: false, reason: "already_answered" };

  // §16.11: the job follows the estimate, and an accepted estimate writes its
  // amount onto the job. Logged rather than rolled back — the customer's answer
  // is recorded, and telling them it failed would be false.
  const row = data[0];
  if (row.job_id && answer === "accepted") {
    const { error: jobError } = await supabase
      .from("jobs")
      .update({ status: "estimate_accepted", estimate_amount: row.total })
      .eq("organization_id", row.organization_id)
      .eq("id", row.job_id);
    if (jobError) {
      console.error("[public-estimate] job did not follow the answer:", jobError.message);
    }
  }

  return { ok: true };
}
