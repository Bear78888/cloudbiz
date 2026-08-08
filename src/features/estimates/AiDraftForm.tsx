"use client";

import { useRef, useState } from "react";

import { MAX_AUDIO_BYTES } from "@/features/ai/audio-limits";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

import { generateEstimateAction } from "./actions";

/**
 * Draft with AI (§16.2–16.4), plus the voice note that can fill it in
 * (§16.3, §16.12).
 *
 * A client component rather than the plain server-rendered form the other
 * estimate actions use, because the voice note needs state the server cannot
 * hold between the recording and the click on "Write a draft": the
 * transcript has to land in this same textarea, editable, before anything is
 * generated — never sent straight into `generateEstimateAction` on its own.
 * `generateEstimateAction` itself is unchanged and still does the submitting;
 * this component only ever populates the field a person would have typed
 * into by hand.
 */

type VoiceError =
  | "not_configured"
  | "limit_reached"
  | "too_large"
  | "no_audio"
  | "not_editable"
  | "network"
  | "unavailable";

function isVoiceError(value: unknown): value is VoiceError {
  return (
    typeof value === "string" &&
    [
      "not_configured",
      "limit_reached",
      "too_large",
      "no_audio",
      "not_editable",
      "network",
      "unavailable",
    ].includes(value)
  );
}

export function AiDraftForm({
  locale,
  dict,
  jobId,
  estimateId,
  taxRate,
}: {
  locale: Locale;
  dict: Dict;
  jobId: string;
  estimateId: string;
  taxRate: number;
}) {
  const e = dict.platform.estimates;
  const inputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null);

  const onVoiceFile = async (file: File) => {
    setVoiceError(null);

    if (file.size === 0) {
      setVoiceError("no_audio");
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setVoiceError("too_large");
      return;
    }

    setTranscribing(true);
    try {
      const body = new FormData();
      body.set("audio", file, file.name || "voice-note");

      const response = await fetch(
        `/${locale}/app/jobs/${jobId}/estimates/${estimateId}/transcribe`,
        { method: "POST", body },
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; text: string }
        | { ok: false; error: unknown }
        | null;

      if (!payload?.ok) {
        setVoiceError(isVoiceError(payload?.error) ? payload.error : "unavailable");
        return;
      }

      // Adds to what is already typed rather than replacing it — the owner
      // may have started a description by hand before remembering to record
      // one, and a voice note is one more fact, not a correction.
      setDescription((current) =>
        current.trim() ? `${current.trim()}\n\n${payload.text}` : payload.text,
      );
    } catch {
      setVoiceError("network");
    } finally {
      setTranscribing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <form action={generateEstimateAction} className="rounded-2xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="estimate_id" value={estimateId} />
      <input type="hidden" name="tax_rate" value={taxRate} />
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{e.aiSection}</h2>

      <label htmlFor="ai_description" className="mt-3 block text-sm text-slate-600">
        {e.aiDescriptionLabel}
      </label>
      <textarea
        id="ai_description"
        name="description"
        rows={3}
        maxLength={4000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={e.aiDescriptionPlaceholder}
        className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />

      {/* A file input rather than in-browser recording: it works the same on
          a phone (where "choose a file" offers "record audio" through the OS)
          and on a laptop with a saved memo, needs no microphone permission
          prompt from this page, and is exactly as testable as any other
          upload. */}
      <div className="mt-3">
        <label
          htmlFor="ai_voice_note"
          className="inline-block min-h-12 cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          {transcribing ? e.aiVoiceTranscribing : e.aiVoiceButton}
        </label>
        <input
          ref={inputRef}
          id="ai_voice_note"
          type="file"
          accept="audio/*"
          capture
          disabled={transcribing}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onVoiceFile(file);
          }}
        />
        <p className="mt-1 text-xs text-slate-500">{e.aiVoiceHint}</p>
        {voiceError ? (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {e.aiVoiceErrors[voiceError]}
          </p>
        ) : null}
      </div>

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
  );
}
