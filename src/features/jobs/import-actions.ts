"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMembership } from "@/features/organizations/service";
import { trackServerEvent } from "@/lib/analytics";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_IMPORT_ROWS } from "./csv";
import type { CustomerInput, JobFieldsInput } from "./schema";

/**
 * Server actions for the CSV import (§14.15). The file itself never leaves the
 * browser: it is parsed and validated client-side by `csv.ts`, and only the
 * rows the owner confirms are sent here.
 */

export interface DuplicateCheckResult {
  /** Customer match keys already present in the tracker. */
  existingKeys: string[];
  error: "generic" | null;
}

/**
 * Step 4 of §14.15. Takes the candidate customers' phone/email/name and
 * answers which ones the tracker already knows — the check runs against the
 * organization's own rows only, under RLS.
 */
export async function checkImportDuplicatesAction(
  candidates: { phone: string | null; email: string | null; name: string | null }[],
): Promise<DuplicateCheckResult> {
  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) return { existingKeys: [], error: "generic" };

  const { data, error } = await supabase
    .from("customers")
    .select("name, phone, email, phone_digits")
    .eq("organization_id", membership.organizationId)
    .is("deleted_at", null)
    .limit(5000);

  if (error) return { existingKeys: [], error: "generic" };

  // Build the same identity keys the client built, from the stored rows.
  const keys = new Set<string>();
  for (const row of data ?? []) {
    const digits = (row.phone_digits as string | null) ?? null;
    if (digits) {
      keys.add(`phone:${digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits}`);
    }
    const email = (row.email as string | null)?.trim().toLowerCase();
    if (email) keys.add(`email:${email}`);
    const name = (row.name as string | null)?.trim().replace(/\s+/g, " ").toLowerCase();
    if (name) keys.add(`name:${name}`);
  }

  // Only report keys the caller actually asked about.
  const asked = new Set<string>();
  for (const candidate of candidates.slice(0, MAX_IMPORT_ROWS)) {
    const digits = candidate.phone?.replace(/\D+/g, "") ?? "";
    const normalized =
      digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (normalized) asked.add(`phone:${normalized}`);
    else if (candidate.email) asked.add(`email:${candidate.email.trim().toLowerCase()}`);
    else if (candidate.name) {
      asked.add(`name:${candidate.name.trim().replace(/\s+/g, " ").toLowerCase()}`);
    }
  }

  return { existingKeys: [...asked].filter((key) => keys.has(key)), error: null };
}

export interface ImportResult {
  jobs: number;
  customersCreated: number;
  customersMatched: number;
  error: "generic" | "empty" | "too_many" | null;
}

export async function importJobsAction(
  locale: string,
  rows: { customer: CustomerInput; job: JobFieldsInput }[],
): Promise<ImportResult> {
  const uiLocale: Locale = isLocale(locale) ? locale : "en";
  const empty: ImportResult = { jobs: 0, customersCreated: 0, customersMatched: 0, error: null };

  if (rows.length === 0) return { ...empty, error: "empty" };
  if (rows.length > MAX_IMPORT_ROWS) return { ...empty, error: "too_many" };

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) return { ...empty, error: "generic" };

  // One RPC, one transaction: a half-finished import is worse than none.
  const { data, error } = await supabase.rpc("import_jobs", {
    p_organization_id: membership.organizationId,
    p_rows: rows,
  });

  if (error || !data) return { ...empty, error: "generic" };

  const result = data as { jobs: number; customers_created: number; customers_matched: number };
  trackServerEvent("jobs_imported", {
    organization_id: membership.organizationId,
    jobs: result.jobs,
    customers_created: result.customers_created,
  });

  revalidatePath(`/${uiLocale}/app/jobs`);
  revalidatePath(`/${uiLocale}/app`);

  return {
    jobs: result.jobs,
    customersCreated: result.customers_created,
    customersMatched: result.customers_matched,
    error: null,
  };
}
