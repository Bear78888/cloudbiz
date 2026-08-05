import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { must } from "@/lib/supabase/query";

import {
  canTransition,
  computeTotals,
  contentBlockers,
  isReleased,
  jobStatusForEstimate,
  type EstimateItemType,
  type EstimateStatus,
  type LineItemInput,
} from "./model";

/**
 * Estimate storage (§16).
 *
 * Reads go through `must()`: a failed query must not be mistaken for "no
 * estimate", which is how a job would silently appear to have none.
 */

/**
 * The customer-facing link's secret.
 *
 * 32 random bytes, base64url. Never derived from the estimate's id: an id that
 * appears in an internal URL would then be enough to open the customer's copy,
 * which is the whole failure this column exists to avoid. Long enough that
 * guessing is not a strategy, since the page it opens has no other credential.
 */
function newPublicToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface EstimateSummary {
  id: string;
  jobId: string | null;
  version: number;
  status: EstimateStatus;
  title: string;
  total: string;
  createdAt: string;
  sentAt: string | null;
}

export interface EstimateItemRow {
  id: string;
  itemType: EstimateItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface EstimateDetail extends EstimateSummary {
  locale: "en" | "es";
  scope: string | null;
  terms: string | null;
  subtotal: string;
  tax: string;
  /** A fraction, as stored — 0.0825 for 8.25%. */
  taxRate: number;
  items: EstimateItemRow[];
}

export async function listEstimatesForJob(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
): Promise<EstimateSummary[]> {
  const rows = await must(
    supabase
      .from("estimates")
      .select("id, job_id, version, status, title, total, created_at, sent_at")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .order("version", { ascending: false }),
    "estimates:list",
  );

  return (rows ?? []).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    version: row.version,
    status: row.status as EstimateStatus,
    title: row.title,
    total: String(row.total),
    createdAt: row.created_at,
    sentAt: row.sent_at,
  }));
}

export async function getEstimate(
  supabase: SupabaseClient,
  organizationId: string,
  estimateId: string,
): Promise<EstimateDetail | null> {
  const row = await must(
    supabase
      .from("estimates")
      .select(
        "id, job_id, version, status, title, total, subtotal, tax, tax_rate, locale, scope, terms, created_at, sent_at",
      )
      .eq("organization_id", organizationId)
      .eq("id", estimateId)
      .maybeSingle(),
    "estimates:get",
  );
  if (!row) return null;

  const items = await must(
    supabase
      .from("estimate_items")
      .select("id, item_type, description, quantity, unit_price, total, sort_order")
      .eq("organization_id", organizationId)
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    "estimates:items",
  );

  return {
    id: row.id,
    jobId: row.job_id,
    version: row.version,
    status: row.status as EstimateStatus,
    title: row.title,
    total: String(row.total),
    subtotal: String(row.subtotal),
    tax: String(row.tax),
    taxRate: Number(row.tax_rate),
    locale: row.locale as "en" | "es",
    scope: row.scope,
    terms: row.terms,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    items: (items ?? []).map((item) => ({
      id: item.id,
      itemType: item.item_type as EstimateItemType,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      total: Number(item.total),
      sortOrder: item.sort_order,
    })),
  };
}

/**
 * Creates the next version of an estimate for a job.
 *
 * The version is computed from what exists rather than passed in: two people
 * creating an estimate at once must not both write version 2, and the unique
 * index would reject the second — better to ask the database what the last one
 * was than to hand the caller a number to get wrong.
 */
export async function createEstimateForJob(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string,
  input: { title: string; locale: "en" | "es" },
): Promise<{ id: string } | { error: string }> {
  const existing = await must(
    supabase
      .from("estimates")
      .select("version")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .order("version", { ascending: false })
      .limit(1),
    "estimates:last-version",
  );

  const nextVersion = ((existing ?? [])[0]?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("estimates")
    .insert({
      organization_id: organizationId,
      job_id: jobId,
      version: nextVersion,
      title: input.title,
      locale: input.locale,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

/**
 * Saves the whole draft: header fields, line items, and the totals they imply.
 *
 * Totals are computed here rather than taken from the form. The browser's
 * running total is a convenience; if it were also the number that got stored,
 * anyone could post a $10 total for a $1,000 estimate, and the customer would
 * be shown a price the owner never approved.
 *
 * Refuses once the customer has seen it (§25.3): editing a sent document in
 * place would change what someone was asked to agree to, after they were asked.
 * A different price is a new version.
 */
export async function saveEstimateDraft(
  supabase: SupabaseClient,
  organizationId: string,
  estimateId: string,
  input: {
    title: string;
    scope: string | null;
    terms: string | null;
    taxRate: number;
    items: LineItemInput[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await must(
    supabase
      .from("estimates")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("id", estimateId)
      .maybeSingle(),
    "estimates:status-before-edit",
  );
  if (!current) return { ok: false, error: "not_found" };
  if (isReleased(current.status as EstimateStatus)) return { ok: false, error: "already_sent" };

  const totals = computeTotals(input.items, input.taxRate);

  const { error: deleteError } = await supabase
    .from("estimate_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimateId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (totals.items.length > 0) {
    const { error: insertError } = await supabase.from("estimate_items").insert(
      totals.items.map((item, index) => ({
        estimate_id: estimateId,
        organization_id: organizationId,
        item_type: item.itemType,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        sort_order: index,
      })),
    );
    if (insertError) return { ok: false, error: insertError.message };
  }

  // Editing the numbers withdraws the approval: `ready` means "these are the
  // figures I checked", and they are no longer the figures that were checked.
  const { error: headerError } = await supabase
    .from("estimates")
    .update({
      title: input.title,
      scope: input.scope,
      terms: input.terms,
      tax_rate: input.taxRate,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status: "draft",
    })
    .eq("organization_id", organizationId)
    .eq("id", estimateId);
  if (headerError) return { ok: false, error: headerError.message };

  return { ok: true };
}

/**
 * Moves the estimate to a new status and keeps the job in step (§16.11).
 *
 * The transition is checked against the state machine rather than trusted from
 * the form: a stale page or a crafted request must not be able to jump a draft
 * straight to `sent` and skip the approval §16.5 requires.
 */
export async function setEstimateStatus(
  supabase: SupabaseClient,
  organizationId: string,
  estimateId: string,
  next: EstimateStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await must(
    supabase
      .from("estimates")
      .select("status, job_id, total, title, public_token")
      .eq("organization_id", organizationId)
      .eq("id", estimateId)
      .maybeSingle(),
    "estimates:status-before-change",
  );
  if (!current) return { ok: false, error: "not_found" };

  const from = current.status as EstimateStatus;
  if (from === next) return { ok: true };
  if (!canTransition(from, next)) return { ok: false, error: "invalid_transition" };

  // Approving is the moment §16.5 exists for, so it is the moment to check
  // there is something to approve. The item count comes from the database
  // rather than the page the button was on, which may be minutes stale.
  if (next === "ready") {
    const items = await must(
      supabase
        .from("estimate_items")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("estimate_id", estimateId),
      "estimates:items-before-approve",
    );
    const blockers = contentBlockers({
      itemCount: items?.length ?? 0,
      total: Number(current.total),
      title: current.title,
    });
    if (blockers.length > 0) return { ok: false, error: blockers[0] };
  }

  const now = new Date().toISOString();
  const stamps: Record<string, string> = {};
  if (next === "sent") stamps.sent_at = now;
  if (next === "viewed") stamps.viewed_at = now;
  if (next === "accepted") stamps.accepted_at = now;
  if (next === "rejected") stamps.rejected_at = now;

  // The link is minted at the moment the estimate leaves the office, not when
  // it is created: a token that exists on a draft is a URL that works before
  // anyone meant to share it. `estimates_sent_has_token` enforces the same
  // thing from the other side.
  const token = next === "sent" && !current.public_token ? { public_token: newPublicToken() } : {};

  const { error } = await supabase
    .from("estimates")
    .update({ status: next, ...stamps, ...token })
    .eq("organization_id", organizationId)
    .eq("id", estimateId);
  if (error) return { ok: false, error: error.message };

  // §16.11. The job follows the estimate, and an accepted estimate also writes
  // its amount onto the job — that number is what the owner will be paid, and
  // retyping it is how it stops matching.
  const jobStatus = jobStatusForEstimate(next);
  if (current.job_id && jobStatus) {
    const jobUpdate: Record<string, unknown> = { status: jobStatus };
    if (next === "accepted") jobUpdate.estimate_amount = current.total;

    const { error: jobError } = await supabase
      .from("jobs")
      .update(jobUpdate)
      .eq("organization_id", organizationId)
      .eq("id", current.job_id);
    if (jobError) {
      // The estimate has already moved; saying it failed would be false. The
      // job being out of step is worth a log, not a rollback the user cannot
      // interpret.
      console.error("[estimates] job status did not follow the estimate:", jobError.message);
    }
  }

  return { ok: true };
}
