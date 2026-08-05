"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { getJob } from "@/features/jobs/service";
import { trackServerEvent } from "@/lib/analytics";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { EstimateActionState } from "./action-state";
import { isEstimateStatus, type EstimateStatus } from "./model";
import { MAX_LINE_ITEMS, parseEstimateForm, type RawLineItem } from "./schema";
import { createEstimateForJob, saveEstimateDraft, setEstimateStatus } from "./service";

/**
 * Server actions for the Estimate Maker (§16).
 *
 * As in the Job Tracker, the organization is re-derived from the session rather
 * than read from a form field, so a tampered `organization_id` never reaches a
 * query — and RLS would reject it if it did.
 */

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "en");
  return isLocale(value) ? value : "en";
}

async function requireContext() {
  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  return { supabase, membership };
}

/**
 * Line-item fields arrive as parallel arrays — `items[].description` repeated
 * once per row — because that is what an ordinary `<form>` posts. Reading them
 * by index keeps a row's four fields together; a row whose description was
 * cleared but whose price was not must not silently inherit the next row's.
 */
function readLineItems(formData: FormData): RawLineItem[] {
  const descriptions = formData.getAll("item_description");
  const types = formData.getAll("item_type");
  const quantities = formData.getAll("item_quantity");
  const prices = formData.getAll("item_unit_price");

  const rows: RawLineItem[] = [];
  const count = Math.min(descriptions.length, MAX_LINE_ITEMS);
  for (let index = 0; index < count; index += 1) {
    const at = (values: FormDataEntryValue[]) => {
      const value = values[index];
      return typeof value === "string" ? value : undefined;
    };
    rows.push({
      description: at(descriptions),
      item_type: at(types),
      quantity: at(quantities),
      unit_price: at(prices),
    });
  }
  return rows;
}

/** Creates the next version for a job and opens it (§25.3). */
export async function createEstimateAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const jobId = String(formData.get("job_id") ?? "").trim();

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);
  if (!jobId) redirect(`/${locale}/app/jobs`);

  // The title defaults to the job's, because that is what the estimate is for
  // and retyping it is a step with no decision in it.
  const job = await getJob(supabase, membership.organizationId, jobId);
  if (!job) redirect(`/${locale}/app/jobs`);

  const result = await createEstimateForJob(supabase, membership.organizationId, jobId, {
    title: job.title,
    locale,
  });
  if ("error" in result) {
    revalidatePath(`/${locale}/app/jobs/${jobId}`);
    redirect(`/${locale}/app/jobs/${jobId}?estimate_error=1`);
  }

  trackServerEvent("estimate_created", { organization_id: membership.organizationId });

  revalidatePath(`/${locale}/app/jobs/${jobId}`);
  redirect(`/${locale}/app/jobs/${jobId}/estimates/${result.id}`);
}

export async function saveEstimateAction(
  _previous: EstimateActionState,
  formData: FormData,
): Promise<EstimateActionState> {
  const locale = localeFrom(formData);
  const jobId = String(formData.get("job_id") ?? "").trim();
  const estimateId = String(formData.get("estimate_id") ?? "").trim();

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);
  if (!estimateId) return { errors: {}, formError: "not_found", saved: false };

  const parsed = parseEstimateForm({
    title: String(formData.get("title") ?? ""),
    scope: String(formData.get("scope") ?? ""),
    terms: String(formData.get("terms") ?? ""),
    tax_rate: String(formData.get("tax_rate") ?? ""),
    items: readLineItems(formData),
  });
  if (!parsed.ok) return { errors: parsed.errors, formError: null, saved: false };

  const result = await saveEstimateDraft(
    supabase,
    membership.organizationId,
    estimateId,
    parsed.value,
  );
  if (!result.ok) {
    const formError =
      result.error === "not_found" || result.error === "already_sent" ? result.error : "generic";
    return { errors: {}, formError, saved: false };
  }

  revalidatePath(`/${locale}/app/jobs/${jobId}`);
  revalidatePath(`/${locale}/app/jobs/${jobId}/estimates/${estimateId}`);
  return { errors: {}, formError: null, saved: true };
}

/**
 * Approve, un-approve, mark sent, or record the customer's answer (§16.5).
 *
 * One action for every move because they are all the same write; which moves
 * are legal is decided by the state machine in the service, not by which button
 * happened to be rendered.
 */
export async function changeEstimateStatusAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const jobId = String(formData.get("job_id") ?? "").trim();
  const estimateId = String(formData.get("estimate_id") ?? "").trim();
  const next = String(formData.get("status") ?? "").trim();

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);
  if (!estimateId || !isEstimateStatus(next)) redirect(`/${locale}/app/jobs`);

  const result = await setEstimateStatus(
    supabase,
    membership.organizationId,
    estimateId,
    next as EstimateStatus,
  );

  if (result.ok) {
    trackServerEvent("estimate_status_changed", {
      organization_id: membership.organizationId,
      status: next,
    });
  }

  revalidatePath(`/${locale}/app/jobs/${jobId}`);
  revalidatePath(`/${locale}/app/jobs/${jobId}/estimates/${estimateId}`);

  // The reason travels in the URL rather than in a flash cookie: the page is a
  // server component, and a query parameter survives the redirect without
  // inventing a session store for one sentence.
  if (!result.ok) {
    redirect(`/${locale}/app/jobs/${jobId}/estimates/${estimateId}?blocked=${result.error}`);
  }
  redirect(`/${locale}/app/jobs/${jobId}/estimates/${estimateId}`);
}
