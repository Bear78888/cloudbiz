import "server-only";

/**
 * The Anthropic Messages API, over `fetch`.
 *
 * Returns the text and the numbers §27.6 wants recorded — latency, tokens,
 * cost — because the caller cannot work them out afterwards and a tool whose
 * per-request cost is unknown is a tool whose economics arrive with the bill.
 *
 * `AI_API_BASE` is overridable so the end-to-end suite can point at a stub. No
 * test ever calls the real model: a test that did would be slow, expensive and
 * differently wrong each run.
 */

const DEFAULT_API_BASE = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";

/**
 * Price per million tokens, by model.
 *
 * Here rather than in `config.ts` because this is not a price we charge or a
 * limit we promise — it is what a vendor charges us, used to fill in
 * `usage_events.provider_cost`. An unknown model records a null cost rather
 * than a guess: a wrong number in a cost column is worse than a missing one,
 * because it will be summed.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-5": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

export interface AiUsage {
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  /** USD, or null when this model's pricing is not known here. */
  providerCost: number | null;
}

export type AiResult =
  | { ok: true; text: string; usage: AiUsage }
  | { ok: false; error: string; retryable: boolean; usage: AiUsage | null };

function apiBase(): string {
  return (process.env.AI_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
}

export function aiModel(): string {
  return process.env.AI_PROVIDER_MODEL || "claude-sonnet-5";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY);
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  // Six places: a single draft costs fractions of a cent, and rounding to two
  // would record every one of them as zero.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export async function generateText(options: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<AiResult> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ai_not_configured", retryable: false, usage: null };
  }

  const model = aiModel();
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(`${apiBase()}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 2000,
        // Instructions here, caller data in `messages` — the structural half of
        // the injection defence described in prompt.ts.
        system: options.system,
        messages: [{ role: "user", content: options.user }],
      }),
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
      // 429 and 5xx are worth another attempt; a 400 means we sent something
      // wrong and sending it again would be wrong again.
      retryable: response.status === 429 || response.status >= 500,
      usage: null,
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  } | null;

  const inputTokens = payload?.usage?.input_tokens ?? 0;
  const outputTokens = payload?.usage?.output_tokens ?? 0;
  const usage: AiUsage = {
    model,
    latencyMs,
    inputTokens,
    outputTokens,
    providerCost: estimateCost(model, inputTokens, outputTokens),
  };

  const text = (payload?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();

  // A response with no text still cost tokens, so the usage goes back either
  // way — the bill does not care that the answer was useless.
  if (!text) return { ok: false, error: "empty response", retryable: true, usage };

  return { ok: true, text, usage };
}
