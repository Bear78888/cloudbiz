/**
 * Parsing and validating what the model returns (§16.4).
 *
 * Pure, so every shape a model can produce — good JSON, JSON in a code fence,
 * a refusal, a plausible object with a negative price — is a fixture in a test
 * rather than something discovered in production. Nothing here calls a model.
 *
 * The rule the whole module serves: a response that cannot be trusted becomes
 * "no draft", never a half-filled estimate. An owner who is told the draft
 * failed writes it themselves; an owner handed three of five line items may
 * not notice the two that are missing.
 */

import { z } from "zod";

import { ESTIMATE_ITEM_TYPES, type EstimateItemType } from "@/features/estimates/model";

export const draftItemSchema = z.object({
  item_type: z.enum(ESTIMATE_ITEM_TYPES),
  description: z.string().trim().min(1).max(400),
  quantity: z.number().finite().positive().max(10_000),
  unit_price: z.number().finite().min(0).max(1_000_000),
});

export const draftSchema = z.object({
  scope: z.string().trim().max(5000).default(""),
  items: z.array(draftItemSchema).max(60),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string().trim().max(500)).max(20).default([]),
});

export type EstimateDraft = z.infer<typeof draftSchema>;

export interface DraftItem {
  itemType: EstimateItemType;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ParsedDraft {
  scope: string;
  items: DraftItem[];
  confidence: number;
  assumptions: string[];
}

export type ParseResult =
  | { ok: true; draft: ParsedDraft }
  | { ok: false; reason: "not_json" | "wrong_shape" | "refused" | "empty" };

/**
 * Pulls the JSON object out of a response.
 *
 * Models wrap JSON in code fences and add a sentence of preamble even when told
 * not to, and refusing those responses would be refusing a correct answer over
 * punctuation. What is *not* tolerated is guessing: the object must parse, and
 * it must then satisfy the schema.
 */
function extractJson(raw: string): unknown {
  const text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch {
    // A preamble before the object is common; find the outermost braces.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/**
 * Whether the response is the model declining rather than answering.
 *
 * Checked only when the text is not JSON at all: a refusal is prose, and a
 * valid draft that happens to contain the phrase "I can't" in an assumption is
 * still a valid draft.
 */
function looksLikeRefusal(raw: string): boolean {
  return /\b(i (can'?t|cannot|won'?t|am unable)|as an ai|i'?m sorry)\b/i.test(raw);
}

export function parseEstimateDraft(raw: string): ParseResult {
  if (!raw || raw.trim() === "") return { ok: false, reason: "empty" };

  const json = extractJson(raw);
  if (json === undefined) {
    return { ok: false, reason: looksLikeRefusal(raw) ? "refused" : "not_json" };
  }

  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "wrong_shape" };

  return {
    ok: true,
    draft: {
      scope: parsed.data.scope,
      confidence: parsed.data.confidence,
      assumptions: parsed.data.assumptions,
      items: parsed.data.items.map((item) => ({
        itemType: item.item_type,
        description: item.description,
        // Rounded here rather than at save time: these numbers go straight into
        // money columns, and `0.1 + 0.2` is not what a customer should be shown.
        quantity: Math.round(item.quantity * 100) / 100,
        unitPrice: Math.round(item.unit_price * 100) / 100,
      })),
    },
  };
}

/**
 * How confidence is described to the owner (§16.4 reaching the interface).
 *
 * Bands rather than a percentage: "0.62" invites a precision the number does
 * not have. What the owner needs is whether to read the draft closely, and
 * three answers cover that.
 */
export type ConfidenceBand = "low" | "medium" | "high";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence < 0.5) return "low";
  if (confidence < 0.8) return "medium";
  return "high";
}
