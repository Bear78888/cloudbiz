import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { sendEmail, type EmailMessage } from "./client";

/**
 * Sending, and the record that it happened.
 *
 * Every message gets a row before it is handed to the provider, and the row
 * keeps the provider's id afterwards. Delivery tracking (§17.10) is not built
 * yet — Resend reports delivery by webhook, referencing the id returned here,
 * so the webhook that advances `status` will touch this table and nothing else.
 * Sending without recording would mean rewriting every send site to add it.
 */

export type OutboundKind =
  | "estimate.sent"
  | "estimate.reminder"
  | "review.request"
  | "owner.notification";

export interface OutboundContext {
  organizationId: string;
  kind: OutboundKind;
  locale: "en" | "es";
  estimateId?: string | null;
  jobId?: string | null;
  customerId?: string | null;
}

export type DeliveryResult =
  | { ok: true; outboundId: string; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

/**
 * Records the message, sends it, then records what the provider said.
 *
 * The row is written first on purpose. If the process dies between the send and
 * the bookkeeping, a `queued` row is a message that may or may not have gone
 * out — which is a thing someone can investigate. Sending first and recording
 * second would lose the message entirely, and nobody would know to look.
 */
export async function sendAndRecord(
  context: OutboundContext,
  message: EmailMessage,
): Promise<DeliveryResult> {
  const supabase = createSupabaseAdminClient();

  const { data: queued, error: queueError } = await supabase
    .from("outbound_emails")
    .insert({
      organization_id: context.organizationId,
      kind: context.kind,
      estimate_id: context.estimateId ?? null,
      job_id: context.jobId ?? null,
      customer_id: context.customerId ?? null,
      to_email: message.to,
      subject: message.subject,
      locale: context.locale,
      status: "queued",
    })
    .select("id")
    .single();

  if (queueError) return { ok: false, error: queueError.message, retryable: true };

  const sent = await sendEmail(message);

  if (!sent.ok) {
    const { error: markError } = await supabase
      .from("outbound_emails")
      .update({ status: "failed", error: sent.error, failed_at: new Date().toISOString() })
      .eq("id", queued.id);
    if (markError) console.error("[email] could not record the failure:", markError.message);
    return { ok: false, error: sent.error, retryable: sent.retryable };
  }

  const { error: recordError } = await supabase
    .from("outbound_emails")
    .update({
      status: "sent",
      provider_message_id: sent.providerMessageId,
      sent_at: new Date().toISOString(),
    })
    .eq("id", queued.id);

  if (recordError) {
    // The message is gone; saying it failed would be false and would invite a
    // second copy. The row stays `queued` and the log says why.
    console.error("[email] sent but not recorded:", recordError.message);
  }

  return { ok: true, outboundId: queued.id, providerMessageId: sent.providerMessageId };
}

/** What the owner sees about an estimate's mail, newest first. */
export async function listEstimateEmails(
  supabase: SupabaseClient,
  organizationId: string,
  estimateId: string,
): Promise<{ toEmail: string; status: string; sentAt: string | null; error: string | null }[]> {
  const { data, error } = await supabase
    .from("outbound_emails")
    .select("to_email, status, sent_at, error")
    .eq("organization_id", organizationId)
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[email] could not read the delivery log:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    toEmail: row.to_email,
    status: row.status,
    sentAt: row.sent_at,
    error: row.error,
  }));
}
