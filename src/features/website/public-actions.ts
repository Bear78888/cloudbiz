"use server";

import { headers } from "next/headers";

import { clientKey, rateLimit } from "@/lib/rate-limit";
import { trackServerEvent } from "@/lib/analytics";
import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";

import type { LeadActionState } from "./lead-action-state";
import { looksAutomated, parseLeadForm } from "./lead-schema";
import { notifyOwnerOfLead, recordWebsiteLead } from "./lead";
import { organizationForPublishedSlug } from "./public-service";

/**
 * The one action on this platform a stranger can invoke (§19.7).
 *
 * Three things follow from that and none of them are optional:
 *
 *  - It is rate limited. A form with no session is a form a script will find.
 *  - The organization comes from the *published site's slug*, resolved
 *    server-side. Nothing in the submission says which business it is for, so
 *    nothing in the submission can aim it at a different one.
 *  - An unpublished or unknown slug is refused. A form posted at a site that is
 *    not public must not write into that business's job list.
 */

/** Generous for a person filling in a form, tight enough to stop a script. */
const LEAD_RATE_LIMIT = 5;
const LEAD_RATE_WINDOW_MS = 10 * 60_000;

export async function submitLeadAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const localeRaw = String(formData.get("locale") ?? "en");
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "en";
  const dict = getDict(locale);

  const requestHeaders = await headers();
  const limited = rateLimit(
    `lead:${clientKey(requestHeaders)}`,
    LEAD_RATE_LIMIT,
    LEAD_RATE_WINDOW_MS,
  );
  if (!limited.allowed) return { errors: {}, formError: "slow_down", sent: false };

  const raw = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    preferred_locale: String(formData.get("preferred_locale") ?? locale),
    service: String(formData.get("service") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    description: String(formData.get("description") ?? ""),
    preferred_date: String(formData.get("preferred_date") ?? ""),
    consent: String(formData.get("consent") ?? ""),
    website: String(formData.get("website") ?? ""),
  };

  // A bot told it failed a check learns to pass it next time, so this looks
  // exactly like success and writes nothing.
  if (looksAutomated(raw)) return { errors: {}, formError: null, sent: true };

  const parsed = parseLeadForm(raw);
  if (!parsed.ok) return { errors: parsed.errors, formError: null, sent: false };

  const organizationId = await organizationForPublishedSlug(slug);
  if (!organizationId) return { errors: {}, formError: "generic", sent: false };

  const p = dict.publicSite;
  const result = await recordWebsiteLead(organizationId, parsed.value, {
    preferredDate: p.leadPreferredDate,
    zip: p.leadZip,
    titleFallback: p.leadTitleFallback,
  });
  if (!result.ok) return { errors: {}, formError: "generic", sent: false };

  // Best-effort, after the enquiry is safely recorded: a failed notification
  // must not turn a captured lead into an error page for the person who sent it.
  await notifyOwnerOfLead(organizationId, result.outcome.jobId, parsed.value.name);

  trackServerEvent("website_lead_received", {
    organization_id: organizationId,
    matched_existing: result.outcome.matchedExisting,
    locale,
  });

  return { errors: {}, formError: null, sent: true };
}
