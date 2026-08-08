import { NextResponse, type NextRequest } from "next/server";

import { MAX_AUDIO_BYTES } from "@/features/ai/audio-limits";
import { isTranscriptionConfigured, transcribeAudio } from "@/features/ai/transcribe";
import { checkTranscriptionLimit, recordTranscriptionUsage } from "@/features/ai/usage";
import { isEditable } from "@/features/estimates/model";
import { getEstimate } from "@/features/estimates/service";
import { getCurrentMembership } from "@/features/organizations/service";
import { trackServerEvent } from "@/lib/analytics";
import { isLocale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST .../estimates/[estimateId]/transcribe (§16.3, §16.12).
 *
 * Turns a recorded voice note into text for the AI-draft description field —
 * nothing here writes to the estimate itself. The transcript comes back to
 * the browser, where the owner reads and can edit it before anything is
 * generated, exactly like a description they typed by hand; §16.5's review
 * still gates everything downstream of that textarea.
 *
 * Sits under /app/, so an unauthenticated request never reaches this code at
 * all — middleware.ts redirects it to sign-in first (see estimate-pdf.spec.ts
 * for why that matters for how this route gets tested).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; jobId: string; estimateId: string }> },
) {
  const { locale, jobId, estimateId } = await params;
  if (!isLocale(locale)) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const estimate = await getEstimate(supabase, membership.organizationId, estimateId);
  if (!estimate || estimate.jobId !== jobId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  // Same rule as the AI-draft form itself: a released estimate is a document
  // already handed to the customer (§25.3), not something to keep feeding.
  if (!isEditable(estimate.status)) {
    return NextResponse.json({ ok: false, error: "not_editable" }, { status: 409 });
  }

  if (!isTranscriptionConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  // Checked before the body is even read: no point parsing a multipart
  // upload for a call that is going to be refused either way (§27.6).
  const limit = await checkTranscriptionLimit(membership.organizationId);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "limit_reached" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "no_audio" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  }

  const audio = Buffer.from(await file.arrayBuffer());
  const result = await transcribeAudio({
    audio,
    filename: file.name || "voice-note",
    mimeType: file.type || "application/octet-stream",
    language: estimate.locale === "es" ? "es" : "en",
  });

  // Recorded either way: a failed or empty call still cost money against the
  // provider, and both count against the same daily cap as a success would.
  await recordTranscriptionUsage({
    organizationId: membership.organizationId,
    usage: result.usage,
    validation: result.ok ? "ok" : `provider:${result.error.slice(0, 80)}`,
    estimateId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 502 });
  }

  trackServerEvent("estimate_voice_transcribed", { organization_id: membership.organizationId });

  return NextResponse.json({ ok: true, text: result.text });
}
