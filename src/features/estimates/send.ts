import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isEmailConfigured } from "@/features/email/client";
import { sendAndRecord } from "@/features/email/service";
import { renderEstimateEmail } from "@/features/email/templates/estimate";
import { resolveAppUrl } from "@/lib/app-url";
import { formatDate, formatMoney } from "@/lib/datetime";
import { must } from "@/lib/supabase/query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { expiryFor } from "./public-link";

/**
 * Sending an estimate to the customer (§16.9).
 *
 * The order of operations is the whole design:
 *
 *  1. Refuse anything that is not approved (§27.4). Approval is the gate, and
 *     it is checked here rather than trusted from whichever button was drawn.
 *  2. Mint the link if there isn't one — while the estimate is still `ready`.
 *     That is safe because the public page only opens statuses the customer was
 *     actually sent, so a token on an approved-but-unsent estimate opens
 *     nothing. It means the link in the email exists before the email does.
 *  3. Send, and record that we sent.
 *  4. Only then move the estimate to `sent`.
 *
 * Marking it sent first would be the natural way to write this and would be
 * wrong: a failed send would leave an estimate claiming to have reached someone
 * it never reached, with a status the owner cannot walk back.
 */

export type SendFailure =
  | "not_found"
  | "not_approved"
  | "no_customer_email"
  | "email_not_configured"
  | "send_failed";

export type SendEstimateResult =
  | { ok: true; toEmail: string }
  | { ok: false; error: SendFailure; detail?: string };

function newPublicToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function sendEstimateToCustomer(
  supabase: SupabaseClient,
  organizationId: string,
  estimateId: string,
  options: { locale: "en" | "es"; timeZone: string; currency: string; actorId: string | null },
): Promise<SendEstimateResult> {
  const estimate = await must(
    supabase
      .from("estimates")
      .select("id, status, title, total, locale, job_id, public_token, expires_at")
      .eq("organization_id", organizationId)
      .eq("id", estimateId)
      .maybeSingle(),
    "estimate-send:load",
  );
  if (!estimate) return { ok: false, error: "not_found" };

  // §27.4. Not `!isReleased` or any other negation — the one status from which
  // sending is allowed, named.
  if (estimate.status !== "ready") return { ok: false, error: "not_approved" };

  if (!isEmailConfigured()) return { ok: false, error: "email_not_configured" };

  const job = estimate.job_id
    ? await must(
        supabase
          .from("jobs")
          .select("id, customer_id")
          .eq("organization_id", organizationId)
          .eq("id", estimate.job_id)
          .maybeSingle(),
        "estimate-send:job",
      )
    : null;

  const customer = job?.customer_id
    ? await must(
        supabase
          .from("customers")
          .select("id, name, email")
          .eq("organization_id", organizationId)
          .eq("id", job.customer_id)
          .maybeSingle(),
        "estimate-send:customer",
      )
    : null;

  if (!customer?.email) return { ok: false, error: "no_customer_email" };

  const organization = await must(
    supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle(),
    "estimate-send:organization",
  );

  // Step 2: the link, minted while still `ready`.
  const now = new Date().toISOString();
  const token = estimate.public_token ?? newPublicToken();
  const expiresAt = estimate.expires_at ?? expiryFor(now);

  if (!estimate.public_token || !estimate.expires_at) {
    const { error: linkError } = await supabase
      .from("estimates")
      .update({ public_token: token, expires_at: expiresAt })
      .eq("organization_id", organizationId)
      .eq("id", estimateId);
    if (linkError) return { ok: false, error: "send_failed", detail: linkError.message };
  }

  // The estimate's own language, not the owner's screen: a customer quoted in
  // Spanish should not be emailed in English about it.
  const emailLocale = (estimate.locale === "es" ? "es" : "en") as "en" | "es";
  const appUrl = resolveAppUrl();
  const link = `${(appUrl ?? "").replace(/\/$/, "")}/e/${emailLocale}/${token}`;

  const rendered = renderEstimateEmail({
    locale: emailLocale,
    businessName: organization?.name ?? "",
    customerName: customer.name,
    title: estimate.title,
    total: formatMoney(Number(estimate.total), emailLocale, options.currency),
    link,
    expiresOn: formatDate(expiresAt, emailLocale, options.timeZone),
  });

  // Step 3.
  const delivery = await sendAndRecord(
    {
      organizationId,
      kind: "estimate.sent",
      locale: emailLocale,
      estimateId,
      jobId: estimate.job_id,
      customerId: customer.id,
    },
    {
      to: customer.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    },
  );

  if (!delivery.ok) {
    return { ok: false, error: "send_failed", detail: delivery.error };
  }

  // Step 4: it actually went, so now it is sent.
  const { error: statusError } = await supabase
    .from("estimates")
    .update({ status: "sent", sent_at: now })
    .eq("organization_id", organizationId)
    .eq("id", estimateId);

  if (statusError) {
    // The customer has the email. Reporting failure would invite a second copy
    // of a price quote, which is worse than a status the owner can fix.
    console.error("[estimate-send] sent but the status did not move:", statusError.message);
  }

  await recordSendActivity(organizationId, estimate.job_id, customer.id, {
    estimateId,
    toEmail: customer.email,
    actorId: options.actorId,
  });

  if (estimate.job_id) {
    const { error: jobError } = await supabase
      .from("jobs")
      .update({ status: "estimate_sent" })
      .eq("organization_id", organizationId)
      .eq("id", estimate.job_id);
    if (jobError) console.error("[estimate-send] job did not follow:", jobError.message);
  }

  return { ok: true, toEmail: customer.email };
}

/**
 * §16.11: sending shows up in the job's history.
 *
 * Written with the service role because `job_activities` is select-only for
 * clients — the history is written by the system, which is what makes it worth
 * reading. The address is recorded; the message body is not.
 */
async function recordSendActivity(
  organizationId: string,
  jobId: string | null,
  customerId: string,
  details: { estimateId: string; toEmail: string; actorId: string | null },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("job_activities").insert({
    organization_id: organizationId,
    job_id: jobId,
    customer_id: customerId,
    event_type: "estimate.sent",
    actor_type: details.actorId ? "user" : "system",
    actor_id: details.actorId,
    metadata: { estimate_id: details.estimateId, to: details.toEmail },
  });
  if (error) console.error("[estimate-send] activity not recorded:", error.message);
}
