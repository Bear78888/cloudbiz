"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { trackServerEvent } from "@/lib/analytics";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JobActionState } from "./action-state";
import { parseJobForm, type RawForm } from "./schema";
import {
  MAX_BULK_JOBS,
  createJob,
  getJob,
  setJobDeleted,
  setJobStatus,
  setJobsStatus,
  updateJob,
} from "./service";

/**
 * Server actions for the Job Tracker (§13.8).
 *
 * Every action re-derives the organization from the session instead of
 * trusting a form field, so a tampered `organization_id` cannot reach a query
 * — and RLS would reject it even if it did.
 */

const FORM_FIELDS = [
  "customer_name",
  "customer_phone",
  "customer_email",
  "customer_locale",
  "sms_consent",
  "title",
  "service",
  "description",
  "status",
  "priority",
  "source",
  "address",
  "scheduled_start",
  "scheduled_end",
  "estimate_amount",
  "job_total",
  "materials_cost",
  "payment_status",
  "assigned_user_id",
  "notes",
] as const;

function toRawForm(formData: FormData): RawForm {
  const raw: RawForm = {};
  for (const field of FORM_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") raw[field] = value;
  }
  return raw;
}

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "en");
  return isLocale(value) ? value : "en";
}

async function requireContext() {
  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  return { supabase, membership };
}

export async function saveJobAction(
  _previous: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const locale = localeFrom(formData);
  const jobId = String(formData.get("job_id") ?? "").trim();

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);

  const parsed = parseJobForm(toRawForm(formData), membership.timezone);
  if (!parsed.ok) return { errors: parsed.errors, formError: null };

  if (jobId) {
    const existing = await getJob(supabase, membership.organizationId, jobId);
    if (!existing) return { errors: {}, formError: "not_found" };

    const result = await updateJob(
      supabase,
      membership.organizationId,
      jobId,
      parsed.value,
      existing.customer_id,
    );
    if ("error" in result) return { errors: {}, formError: "generic" };
  } else {
    const result = await createJob(supabase, membership.organizationId, parsed.value);
    if ("error" in result) return { errors: {}, formError: "generic" };

    trackServerEvent("job_created", {
      organization_id: membership.organizationId,
      status: parsed.value.job.status,
      source: parsed.value.job.source,
    });
    revalidatePath(`/${locale}/app/jobs`);
    redirect(`/${locale}/app/jobs/${result.id}`);
  }

  revalidatePath(`/${locale}/app/jobs`);
  redirect(`/${locale}/app/jobs/${jobId}`);
}

export async function changeJobStatusAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const jobId = String(formData.get("job_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  const { supabase, membership } = await requireContext();
  if (!membership || !jobId) redirect(`/${locale}/app/jobs`);

  const result = await setJobStatus(supabase, membership.organizationId, jobId, status);
  if (!("error" in result)) {
    trackServerEvent("job_status_changed", {
      organization_id: membership.organizationId,
      status,
    });
  }

  revalidatePath(`/${locale}/app/jobs`);
  revalidatePath(`/${locale}/app/jobs/${jobId}`);
}

/**
 * Bulk status change (§13.8). The selection arrives as repeated `job_ids`
 * fields from an ordinary form, so it works before JavaScript loads; ids the
 * caller does not own are filtered out by the organization scope and by RLS.
 */
export async function changeJobsStatusAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const status = String(formData.get("status") ?? "").trim();
  const jobIds = formData
    .getAll("job_ids")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_BULK_JOBS);

  const returnTo = String(formData.get("return_to") ?? "").trim();
  const safeReturn =
    returnTo.startsWith(`/${locale}/app/jobs`) && !returnTo.startsWith("//")
      ? returnTo
      : `/${locale}/app/jobs`;

  const { supabase, membership } = await requireContext();
  if (!membership) redirect(`/${locale}/onboarding`);

  if (jobIds.length > 0) {
    const result = await setJobsStatus(supabase, membership.organizationId, jobIds, status);
    if (!("error" in result)) {
      trackServerEvent("job_status_changed", {
        organization_id: membership.organizationId,
        status,
        bulk: result.changed,
      });
    }
  }

  revalidatePath(`/${locale}/app/jobs`);
  redirect(safeReturn);
}

/** Soft delete and restore share an action — both are a `deleted_at` write (§14.12). */
export async function setJobDeletedAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const jobId = String(formData.get("job_id") ?? "").trim();
  const deleted = String(formData.get("deleted") ?? "true") === "true";

  const { supabase, membership } = await requireContext();
  if (!membership || !jobId) redirect(`/${locale}/app/jobs`);

  await setJobDeleted(supabase, membership.organizationId, jobId, deleted);
  if (deleted) {
    trackServerEvent("job_deleted", { organization_id: membership.organizationId });
  }

  revalidatePath(`/${locale}/app/jobs`);
  revalidatePath(`/${locale}/app/jobs/${jobId}`);

  if (deleted) redirect(`/${locale}/app/jobs`);
  redirect(`/${locale}/app/jobs/${jobId}`);
}
