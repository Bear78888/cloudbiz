import "server-only";

/**
 * Speech-to-text for the estimate voice note (§16.3, §16.12), over `fetch`.
 *
 * A second, separate provider from `client.ts`'s drafting model — not because
 * the vendor matters architecturally, but because it is a different kind of
 * call with a different price (per minute of audio, not per token) and its
 * own daily cap (`usage.ts`). `TRANSCRIBE_API_BASE` is overridable so the
 * end-to-end suite can point at a stub; no test ever calls a real provider.
 *
 * The wire format defaults to OpenAI's Whisper endpoint (multipart upload,
 * `verbose_json` response for a real duration in seconds) because it is the
 * most widely mirrored shape for hosted speech-to-text — a different vendor
 * behind the same three env vars would need only this file to change.
 */

const DEFAULT_API_BASE = "https://api.openai.com";

/**
 * USD per minute of audio, by model.
 *
 * Same rule as `MODEL_PRICING` in client.ts: an unlisted model records a null
 * cost rather than a guessed one, because a wrong number in a cost column is
 * worse than a missing one — it gets summed.
 */
const TRANSCRIBE_MODEL_PRICING: Record<string, number> = {
  "whisper-1": 0.006,
};

export interface TranscribeUsage {
  model: string;
  latencyMs: number;
  /** Seconds, from the provider — never estimated from file size or bitrate. */
  durationSeconds: number | null;
  /** USD, or null when the duration or this model's pricing is not known. */
  providerCost: number | null;
}

export type TranscribeResult =
  | { ok: true; text: string; usage: TranscribeUsage }
  | { ok: false; error: string; retryable: boolean; usage: TranscribeUsage | null };

function apiBase(): string {
  return (process.env.TRANSCRIBE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
}

export function transcribeModel(): string {
  return process.env.TRANSCRIBE_MODEL || "whisper-1";
}

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.TRANSCRIBE_API_KEY);
}

export function transcribeCost(model: string, durationSeconds: number | null): number | null {
  if (durationSeconds === null) return null;
  const perMinute = TRANSCRIBE_MODEL_PRICING[model];
  if (perMinute === undefined) return null;
  const cost = (durationSeconds / 60) * perMinute;
  // Six places, same as client.ts: a short voice note costs a fraction of a
  // cent, and rounding to two would record every one of them as zero.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export async function transcribeAudio(options: {
  audio: Buffer;
  filename: string;
  mimeType: string;
  /** §16.7: the document's language, not the owner's interface language. */
  language?: "en" | "es";
}): Promise<TranscribeResult> {
  const apiKey = process.env.TRANSCRIBE_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "transcription_not_configured", retryable: false, usage: null };
  }

  const model = transcribeModel();
  const startedAt = Date.now();

  const form = new FormData();
  form.set("model", model);
  form.set("response_format", "verbose_json");
  if (options.language) form.set("language", options.language);
  // A fresh Uint8Array rather than the Buffer itself: Buffer's backing
  // ArrayBufferLike is not always a plain ArrayBuffer, which is all `Blob`
  // accepts — same conversion the PDF route uses for the same reason.
  form.set(
    "file",
    new Blob([new Uint8Array(options.audio)], { type: options.mimeType || "application/octet-stream" }),
    options.filename || "voice-note",
  );

  let response: Response;
  try {
    response = await fetch(`${apiBase()}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "network",
      retryable: true,
      usage: null,
    };
  }

  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: `${response.status}: ${body.slice(0, 300)}`,
      retryable: response.status === 429 || response.status >= 500,
      usage: null,
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    text?: string;
    duration?: number;
  } | null;

  const durationSeconds = typeof payload?.duration === "number" ? payload.duration : null;
  const usage: TranscribeUsage = {
    model,
    latencyMs,
    durationSeconds,
    providerCost: transcribeCost(model, durationSeconds),
  };

  const text = (payload?.text ?? "").trim();
  // Silence and a provider hiccup look the same from here — an empty
  // transcript still cost money, so the usage goes back either way, but there
  // is nothing to hand the owner and no reason to imply there was.
  if (!text) return { ok: false, error: "empty transcript", retryable: false, usage };

  return { ok: true, text, usage };
}
