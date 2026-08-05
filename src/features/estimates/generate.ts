import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateText, isAiConfigured } from "@/features/ai/client";
import { confidenceBand, parseEstimateDraft } from "@/features/ai/estimate-draft";
import {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  systemPrompt,
  truncateDescription,
  userPrompt,
} from "@/features/ai/prompt";
import { checkDraftLimit, recordDraftUsage } from "@/features/ai/usage";
import { must } from "@/lib/supabase/query";

import { computeTotals } from "./model";
import { isEditable, type EstimateStatus } from "./model";

/**
 * Drafting an estimate with the model (§16.2–16.4).
 *
 * What this deliberately cannot do: produce anything sendable. The result is
 * written into a `draft`, and §16.5 still requires a person to approve it
 * before it can reach a customer. That is what makes an untrusted job
 * description safe to feed in at all — a successful prompt injection produces a
 * draft the owner reads and rejects, not an estimate that leaves the building.
 */

export type GenerateFailure =
  | "not_found"
  | "not_editable"
  | "ai_not_configured"
  | "no_description"
  | "limit_reached"
  | "unavailable";

export type GenerateResult =
  | { ok: true; confidence: number; band: "low" | "medium" | "high"; itemCount: number }
  | { ok: false; error: GenerateFailure; used?: number; limit?: number };

export async function generateEstimateDraft(
  supabase: SupabaseClient,
  organizationId: string,
  estimateId: string,
  input: { description: string; trade: string; taxRate: number },
): Promise<GenerateResult> {
  const description = truncateDescription(input.description);
  if (description === "") return { ok: false, error: "no_description" };
  if (!isAiConfigured()) return { ok: false, error: "ai_not_configured" };

  const estimate = await must(
    supabase
      .from("estimates")
      .select("id, status, title, locale")
      .eq("organization_id", organizationId)
      .eq("id", estimateId)
      .maybeSingle(),
    "estimate-generate:load",
  );
  if (!estimate) return { ok: false, error: "not_found" };

  // A sent estimate is a document (§25.3). Regenerating one would rewrite what
  // a customer was asked to agree to.
  if (!isEditable(estimate.status as EstimateStatus)) {
    return { ok: false, error: "not_editable" };
  }

  // The cap is checked before the call, not after: the point is not to spend
  // the money (§27.6, LIMITS in config.ts).
  const limit = await checkDraftLimit(organizationId);
  if (!limit.allowed) {
    return { ok: false, error: "limit_reached", used: limit.used, limit: limit.limit };
  }

  // §16.7: the document's language, not the owner's interface. An estimate
  // written in Spanish is drafted in Spanish even if the owner works in English.
  const locale = (estimate.locale === "es" ? "es" : "en") as "en" | "es";

  const result = await generateText({
    system: systemPrompt({ locale, trade: input.trade }),
    user: userPrompt({ description, locale, trade: input.trade, jobTitle: estimate.title }),
  });

  const attempts = 1;

  if (!result.ok) {
    await recordDraftUsage({
      organizationId,
      usage: result.usage,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      validation: `provider:${result.error.slice(0, 80)}`,
      attempts,
      estimateId,
    });
    return { ok: false, error: "unavailable" };
  }

  const parsed = parseEstimateDraft(result.text);

  await recordDraftUsage({
    organizationId,
    usage: result.usage,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    validation: parsed.ok ? "ok" : `invalid:${parsed.reason}`,
    attempts,
    estimateId,
  });

  // A response we cannot trust becomes "no draft", never a partial estimate.
  if (!parsed.ok) return { ok: false, error: "unavailable" };

  const totals = computeTotals(parsed.draft.items, input.taxRate);

  // Replace the lines wholesale: drafting is "write me a starting point", and
  // merging into whatever was there would produce a document neither the owner
  // nor the model intended.
  const { error: clearError } = await supabase
    .from("estimate_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimateId);
  if (clearError) return { ok: false, error: "unavailable" };

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
    if (insertError) return { ok: false, error: "unavailable" };
  }

  // Assumptions go into the scope the owner reads, not into a field nobody
  // opens: "I assumed a standard 40-gallon tank" is exactly the sentence that
  // needs checking before a price goes out.
  const scope = [parsed.draft.scope, ...formatAssumptions(parsed.draft.assumptions, locale)]
    .filter(Boolean)
    .join("\n\n");

  const { error: headerError } = await supabase
    .from("estimates")
    .update({
      scope,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      tax_rate: input.taxRate,
      // Status stays `draft`: §16.5 is not something a generator may satisfy.
      status: "draft",
      // §27.2: which prompt wrote this, so a strange estimate can be reproduced.
      ai_model: result.usage.model,
      ai_prompt_version: PROMPT_VERSION,
      ai_schema_version: SCHEMA_VERSION,
      ai_confidence: parsed.draft.confidence,
      ai_generated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", estimateId);
  if (headerError) return { ok: false, error: "unavailable" };

  return {
    ok: true,
    confidence: parsed.draft.confidence,
    band: confidenceBand(parsed.draft.confidence),
    itemCount: totals.items.length,
  };
}

function formatAssumptions(assumptions: string[], locale: "en" | "es"): string[] {
  if (assumptions.length === 0) return [];
  const heading = locale === "es" ? "Supuestos:" : "Assumptions:";
  return [[heading, ...assumptions.map((line) => `— ${line}`)].join("\n")];
}
