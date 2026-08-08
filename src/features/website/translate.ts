import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateText, isAiConfigured } from "@/features/ai/client";
import {
  TRANSLATION_PROMPT_VERSION,
  parseTranslation,
  translationSystemPrompt,
  translationUserPrompt,
} from "@/features/ai/site-translation";
import { checkSiteTranslationLimit, recordSiteTranslationUsage } from "@/features/ai/usage";
import type { Locale } from "@/lib/routes";

import { contentFor, listSiteContent } from "./service";

/**
 * Drafting one language of a site from another (§19.5).
 *
 * What this deliberately cannot do is publish. The result is written with
 * `ai_generated_at` set and `reviewed_at` left alone, which is exactly the
 * state `needsReview` reports and `siteBlockers` refuses to publish. So a
 * machine translation of a licensed trade's promises cannot reach the public
 * on the model's say-so — a person has to open it, read it and save it.
 */

export type TranslateFailure =
  | "not_configured"
  | "no_source"
  | "limit_reached"
  | "unavailable"
  | "generic";

export type TranslateResult =
  | { ok: true }
  | { ok: false; error: TranslateFailure; used?: number; limit?: number };

export async function translateSiteContent(
  supabase: SupabaseClient,
  organizationId: string,
  sourceLocale: Locale,
  targetLocale: Locale,
): Promise<TranslateResult> {
  if (sourceLocale === targetLocale) return { ok: false, error: "no_source" };
  if (!isAiConfigured()) return { ok: false, error: "not_configured" };

  const rows = await listSiteContent(supabase, organizationId);
  const source = contentFor(rows, sourceLocale);

  // Nothing to translate is not a failure of the model, so it never reaches it.
  const hasSource =
    Boolean(source.headline?.trim()) ||
    Boolean(source.aboutText?.trim()) ||
    source.whyChooseUs.length > 0 ||
    source.faq.length > 0;
  if (!hasSource) return { ok: false, error: "no_source" };

  const limit = await checkSiteTranslationLimit(organizationId);
  if (!limit.allowed) {
    return { ok: false, error: "limit_reached", used: limit.used, limit: limit.limit };
  }

  const result = await generateText({
    system: translationSystemPrompt(sourceLocale, targetLocale),
    user: translationUserPrompt({
      headline: source.headline,
      subheadline: source.subheadline,
      aboutText: source.aboutText,
      ctaText: source.ctaText,
      serviceAreaNote: source.serviceAreaNote,
      whyChooseUs: source.whyChooseUs,
      faq: source.faq,
    }),
  });

  const parsed = result.ok ? parseTranslation(result.text) : null;

  // Recorded for every call, including the ones that produced nothing usable:
  // a refusal and a malformed reply both cost money and both count (§27.6).
  await recordSiteTranslationUsage({
    organizationId,
    usage: result.usage,
    promptVersion: TRANSLATION_PROMPT_VERSION,
    validation: result.ok ? (parsed?.ok ? "ok" : (parsed?.error ?? "unknown")) : "provider_error",
    sourceLocale,
    targetLocale,
  });

  if (!result.ok) return { ok: false, error: "unavailable" };
  if (!parsed || !parsed.ok) return { ok: false, error: "unavailable" };

  const now = new Date().toISOString();
  const { error } = await supabase.from("business_site_texts").upsert(
    {
      organization_id: organizationId,
      locale: targetLocale,
      headline: parsed.draft.headline,
      subheadline: parsed.draft.subheadline,
      about_text: parsed.draft.aboutText,
      cta_text: parsed.draft.ctaText,
      service_area_note: parsed.draft.serviceAreaNote,
      why_choose_us: parsed.draft.whyChooseUs,
      faq: parsed.draft.faq,
      // The pair that makes this a draft. `reviewed_at` is deliberately not
      // written: whatever it held is now older than the text, which is exactly
      // how `needsReview` reads "confirmed, then regenerated".
      ai_generated_at: now,
    },
    { onConflict: "organization_id,locale" },
  );

  if (error) {
    console.error("[website] could not save the translation:", error.message);
    return { ok: false, error: "generic" };
  }

  return { ok: true };
}
