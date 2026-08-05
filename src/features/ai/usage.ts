import "server-only";

import { randomUUID } from "node:crypto";

import { LIMITS } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { AiUsage } from "./client";

/**
 * The daily cap on model calls, and the record of every one (§27.6, §15.11).
 *
 * Both live here because they are the same question asked twice: how much of
 * this tool has this organization used today, and what did it cost us.
 */

export const AI_DRAFTS_PER_DAY = LIMITS.estimate_quote_maker.aiDraftsPerDay;

const FEATURE_CODE = "estimate_quote_maker";

/**
 * How many drafts this organization has asked for since midnight UTC.
 *
 * UTC rather than the organization's timezone, deliberately: the cap is a cost
 * control, not a promise about calendar days, and a per-tenant window would
 * mean the same code reads a different limit depending on who is asking.
 * Documented because "your daily limit" reads as local and is not.
 */
export async function draftsUsedToday(organizationId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("feature_code", FEATURE_CODE)
    .gte("occurred_at", since.toISOString());

  if (error) {
    // Fail closed on the *count*, open on the feature: a database hiccup must
    // not hand out unlimited inference, but it also must not permanently lock
    // an owner out of a tool they pay for. Treating the count as zero would do
    // the first; refusing outright would do the second. Reporting the failure
    // lets the caller allow one call and log loudly.
    console.error("[ai-usage] could not count today's drafts:", error.message);
    return Number.NaN;
  }

  return count ?? 0;
}

export interface LimitCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkDraftLimit(organizationId: string): Promise<LimitCheck> {
  const used = await draftsUsedToday(organizationId);
  if (Number.isNaN(used)) {
    // Unknown usage: allow this one, and the failed count is already in the log.
    return { allowed: true, used: 0, limit: AI_DRAFTS_PER_DAY };
  }
  return { allowed: used < AI_DRAFTS_PER_DAY, used, limit: AI_DRAFTS_PER_DAY };
}

/**
 * Records one model call (§27.6).
 *
 * Written for *every* call, including the ones that produced nothing usable: a
 * refusal and a malformed response both cost money and both count against the
 * cap. Recording only successes would make the cap trivially avoidable and the
 * cost figure wrong in the direction that flatters us.
 */
export async function recordDraftUsage(input: {
  organizationId: string;
  usage: AiUsage | null;
  promptVersion: string;
  schemaVersion: string;
  /** What the parser made of it: "ok", or the reason it did not. */
  validation: string;
  attempts: number;
  estimateId: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("usage_events").insert({
    organization_id: input.organizationId,
    feature_code: FEATURE_CODE,
    quantity: 1,
    provider_cost: input.usage?.providerCost ?? null,
    // A generated key rather than something derived from the estimate: a second
    // draft for the same estimate is a second call and a second cost, and an
    // idempotency key that collided would silently drop it from the ledger.
    idempotency_key: `ai-draft:${randomUUID()}`,
    metadata: {
      tool: "estimate_draft",
      prompt_version: input.promptVersion,
      schema_version: input.schemaVersion,
      model: input.usage?.model ?? null,
      latency_ms: input.usage?.latencyMs ?? null,
      input_tokens: input.usage?.inputTokens ?? null,
      output_tokens: input.usage?.outputTokens ?? null,
      validation: input.validation,
      attempts: input.attempts,
      estimate_id: input.estimateId,
    },
  });

  if (error) {
    // The call happened and cost money. Losing the record is worth shouting
    // about, but not worth failing the owner's request over.
    console.error("[ai-usage] could not record a draft:", error.message);
  }
}
