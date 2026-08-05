import "server-only";

/**
 * Resend, over `fetch`.
 *
 * No SDK: the API this needs is one POST, and a dependency that ships its own
 * HTTP stack and retry policy is more surface than the thing it replaces.
 *
 * `RESEND_API_BASE` is overridable for the same reason `GOOGLE_SHEETS_API_BASE`
 * is — the end-to-end suite points it at a local stub so the tests can read
 * what was actually sent. Nothing in CI reaches the real provider.
 */

const DEFAULT_API_BASE = "https://api.resend.com";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a reply should go — the pro, not us. */
  replyTo?: string | null;
}

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

function apiBase(): string {
  return (process.env.RESEND_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Sends one message.
 *
 * Distinguishes retryable from permanent, because they call for different
 * things: a 5xx or a timeout is worth trying again, while a rejected address is
 * a fact the owner needs to see. Collapsing them would mean either retrying a
 * dead address forever or telling someone their working email failed.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "email_not_configured", retryable: false };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
      }),
    });
  } catch (cause) {
    // The network, not the provider. Always worth another attempt.
    return { ok: false, error: cause instanceof Error ? cause.message : "network", retryable: true };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      // Trimmed: this string is stored and shown to the owner, and a provider
      // error page pasted into a database column helps nobody.
      error: `${response.status}: ${body.slice(0, 300)}`,
      retryable: response.status === 429 || response.status >= 500,
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  if (!payload?.id) {
    // Accepted without an id would leave a message we can never match a
    // delivery webhook to (§17.10) — treat it as a failure we can see.
    return { ok: false, error: "provider accepted the message without an id", retryable: false };
  }

  return { ok: true, providerMessageId: payload.id };
}
