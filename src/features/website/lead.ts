import "server-only";

import { fmt, getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";
import { must } from "@/lib/supabase/query";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { leadDescription, leadPhoneDigits, type LeadInput } from "./lead-schema";

/**
 * Turning a website enquiry into a job (§19.7).
 *
 * The service-role client, because the person submitting has no session and
 * `anon` holds no grant on `customers` or `jobs` — and must not. The price is
 * that RLS is not helping, so this module takes an organization id resolved
 * from the *published site's slug* by its caller and never from the form.
 *
 * The rest of §19.7 happens by itself, which is worth knowing rather than
 * re-implementing: inserting the job fires the activity trigger (§13.11), and
 * the sync outbox is filled by triggers on every write (§14.9), so the entry in
 * the tracker's history and the row in the owner's spreadsheet both follow from
 * the insert.
 */

export type LeadFailure = "generic";

export interface LeadOutcome {
  jobId: string;
  customerId: string;
  /** True when the enquiry attached to a customer the owner already had. */
  matchedExisting: boolean;
}

/**
 * Finds the customer this enquiry belongs to, or creates one.
 *
 * **Deliberately never updates a matched customer.** The owner-facing job form
 * does — it treats what the owner typed as the newer truth — and that is
 * exactly the behaviour a public form must not inherit: anyone who knows a
 * customer's phone number could otherwise rewrite that customer's name, email
 * and address in someone else's database by submitting a contact form.
 *
 * Matching on phone digits and then email mirrors `customerMatchKey` (§14.15):
 * a person re-types their name a dozen ways and their number one way.
 */
async function findOrCreateCustomer(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string,
  input: LeadInput,
): Promise<{ id: string; matched: boolean } | null> {
  const digits = input.phone ? leadPhoneDigits(input.phone) : "";

  if (digits.length >= 7) {
    const byPhone = await must(
      supabase
        .from("customers")
        .select("id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .ilike("phone_digits", `%${digits}`)
        .limit(1)
        .maybeSingle(),
      "lead:match-phone",
    );
    if (byPhone) return { id: byPhone.id as string, matched: true };
  }

  if (input.email) {
    const byEmail = await must(
      supabase
        .from("customers")
        .select("id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .eq("email", input.email)
        .limit(1)
        .maybeSingle(),
      "lead:match-email",
    );
    if (byEmail) return { id: byEmail.id as string, matched: true };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      preferred_locale: input.preferredLocale,
      lead_source: "website",
      // §17.9 and §19.7 are different consents. The box on this form is consent
      // to be contacted about this enquiry; SMS marketing consent is not
      // collected here and is never inferred from it.
      sms_consent: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[lead] could not create the customer:", error?.message);
    return null;
  }
  return { id: data.id as string, matched: false };
}

/**
 * Records the enquiry (§19.7 steps 1–5).
 *
 * The job lands as `new_lead` with `source = 'website'`, which is what makes it
 * visible as a website lead forever after — the activity trail records the
 * creation with `actor_type = 'system'` (nobody was signed in), and the source
 * column is what says where it came from.
 */
export async function recordWebsiteLead(
  organizationId: string,
  input: LeadInput,
  labels: { preferredDate: string; zip: string; titleFallback: string },
): Promise<{ ok: true; outcome: LeadOutcome } | { ok: false; error: LeadFailure }> {
  const supabase = createSupabaseAdminClient();

  const customer = await findOrCreateCustomer(supabase, organizationId, input);
  if (!customer) return { ok: false, error: "generic" };

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: organizationId,
      customer_id: customer.id,
      // The service they asked for, or a plain fallback: `title` is not
      // nullable and an empty one would fail the check constraint.
      title: input.service ?? labels.titleFallback,
      service: input.service,
      description: leadDescription(input, labels) || null,
      status: "new_lead",
      source: "website",
      address: input.zip,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[lead] could not create the job:", error?.message);
    return { ok: false, error: "generic" };
  }

  return {
    ok: true,
    outcome: {
      jobId: data.id as string,
      customerId: customer.id,
      matchedExisting: customer.matched,
    },
  };
}

/**
 * Tells the owner (§19.7 step 6).
 *
 * Best-effort, and separate from the write above on purpose: the enquiry is
 * already recorded by the time this runs, and a failed notification must not
 * turn a captured lead into an error page for the customer who sent it.
 *
 * Written in the *owner's* language, not the visitor's. The customer chose
 * Spanish for the page they were reading; the person opening this notification
 * is the tradesperson, and their language is the organization's.
 */
export async function notifyOwnerOfLead(
  organizationId: string,
  jobId: string,
  customerName: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const organization = await must(
    supabase
      .from("organizations")
      .select("default_locale")
      .eq("id", organizationId)
      .maybeSingle(),
    "lead:organization-locale",
  );

  const locale: Locale = isLocale(String(organization?.default_locale ?? "en"))
    ? (organization?.default_locale as Locale)
    : "en";
  const dict = getDict(locale);

  const { error } = await supabase.from("notifications").insert({
    organization_id: organizationId,
    type: "website_lead",
    severity: "info",
    title: dict.platform.website.leadNotificationTitle,
    // The customer's name, and nothing else they typed: a notification is read
    // in places a job row is not (§26.6 — record what happened, not the
    // payload). The message itself is one click away on the job.
    body: fmt(dict.platform.website.leadNotificationBody, { name: customerName }),
    action_url: `/${locale}/app/jobs/${jobId}`,
  });

  if (error) {
    console.error("[lead] could not notify the owner:", error.message);
  }
}
