import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  JOB_STATUSES,
  JOB_PRIORITIES,
  PAYMENT_STATUSES,
  LEAD_SOURCES,
} from "@/features/jobs/model";
import { getDict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

import { customerToRow, jobToRow, type RowContext } from "./rows";
import { getAccessTokenForOrganization, markConnectionNeedsReconnect } from "./service";
import { headerRow, tabTitle } from "./sheet-schema";
import { type SheetsFailure } from "./sheets";
import { MAX_ATTEMPTS, backoffMs, eventOutcome, planWrites, rowRange } from "./sync-plan";

/**
 * The sync worker (§14.9 steps 4–8, §14.11).
 *
 * Reads due outbox events, groups them, writes one batch per tab, and records
 * the outcome. Everything runs under the service role: the worker has no user
 * session, and `sync_outbox` is not writable by any client role.
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/** How many events one run takes. Bounded so a backlog cannot stall a request. */
const BATCH_SIZE = 200;

export interface SyncRunResult {
  claimed: number;
  synced: number;
  retrying: number;
  failed: number;
  disconnected: number;
  reason?: "no_connection" | "no_spreadsheet" | "nothing_due" | "token";
}

function labelsFor(locale: Locale) {
  const dict = getDict(locale);
  const pick = (codes: readonly string[], source: Record<string, string>) =>
    Object.fromEntries(codes.map((code) => [code, source[code] ?? code]));

  return {
    statusLabels: pick(JOB_STATUSES, dict.platform.jobs.statuses as Record<string, string>),
    paymentStatusLabels: pick(
      PAYMENT_STATUSES,
      dict.platform.jobs.paymentStatuses as Record<string, string>,
    ),
    priorityLabels: pick(JOB_PRIORITIES, dict.platform.jobs.priorities as Record<string, string>),
    leadSourceLabels: pick(LEAD_SOURCES, dict.platform.jobs.leadSources as Record<string, string>),
  };
}

function failureFor(status: number): SheetsFailure {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429 || status >= 500) return "rate_limited";
  return "failed";
}

/**
 * Runs one sync pass for an organization.
 *
 * Deliberately not a transaction across Google and Postgres — there is no such
 * thing. The order is chosen so the failure mode is a repeat rather than a
 * loss: events are claimed first, written second, marked third. If the process
 * dies after writing but before marking, the event is retried and the same row
 * is written again — harmless, because writes are keyed by UUID (§14.8) and
 * therefore idempotent. The opposite order would mark an event done and then
 * lose the write.
 */
export async function runSyncForOrganization(organizationId: string): Promise<SyncRunResult> {
  const empty: SyncRunResult = {
    claimed: 0,
    synced: 0,
    retrying: 0,
    failed: 0,
    disconnected: 0,
  };
  const admin = createSupabaseAdminClient();

  const { data: sheet } = await admin
    .from("google_spreadsheets")
    .select("id, spreadsheet_id, tab_mapping")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle();
  if (!sheet) return { ...empty, reason: "no_spreadsheet" };

  const { data: organization } = await admin
    .from("organizations")
    .select("default_locale, timezone")
    .eq("id", organizationId)
    .maybeSingle();

  const locale = ((organization?.default_locale as Locale) ?? "en") satisfies Locale;
  const timeZone = (organization?.timezone as string) ?? "America/New_York";

  const { data: due } = await admin
    .from("sync_outbox")
    .select("id, entity_type, entity_id, attempts")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "retrying"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!due || due.length === 0) return { ...empty, reason: "nothing_due" };

  const token = await getAccessTokenForOrganization(organizationId);
  if (!token.ok) {
    // A connection problem is not the events' fault: park them rather than
    // burning attempts on something only the user can fix (§14.11).
    const parked = token.reason === "transient" ? "retrying" : "disconnected";
    await admin
      .from("sync_outbox")
      .update({
        status: parked,
        last_error: token.reason,
        next_attempt_at: new Date(Date.now() + backoffMs(1)).toISOString(),
      })
      .in(
        "id",
        due.map((event) => event.id as string),
      );
    return { ...empty, claimed: due.length, reason: "token" };
  }

  // Claim: anything picked up here is `processing`, so a second run (a cron
  // tick overlapping a "Sync now" click) does not write the same rows twice.
  const ids = due.map((event) => event.id as string);
  await admin.from("sync_outbox").update({ status: "processing" }).in("id", ids);

  const context: RowContext = {
    timeZone,
    locale,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://handyalliance.com",
    ...labelsFor(locale),
  };

  const jobIds = due.filter((e) => e.entity_type === "job").map((e) => e.entity_id as string);
  const customerIds = due
    .filter((e) => e.entity_type === "customer")
    .map((e) => e.entity_id as string);

  const rowsByTab: Record<"jobs" | "customers", string[][]> = { jobs: [], customers: [] };
  // Which entities actually produced a row. An event whose row was never built
  // must never be reported as synced — see eventOutcome().
  const rendered = new Set<string>();
  let readFailure: SheetsFailure | null = null;

  if (jobIds.length > 0) {
    // `source`, not `lead_source`: that is the column jobs actually has, and
    // asking for the other one is what produced a 400 that this code used to
    // swallow. No embedded select either — an embed depends on PostgREST
    // resolving a relationship from its schema cache, and when that fails the
    // whole query fails (the same trap as getCurrentMembership).
    const { data: jobs, error: jobsError } = await admin
      .from("jobs")
      .select(
        "id, customer_id, status, created_at, updated_at, service, title, description, source, priority, address, scheduled_start, estimate_amount, job_total, materials_cost, payment_status, notes, deleted_at, last_follow_up_at, review_requested_at",
      )
      .in("id", jobIds);

    if (jobsError) {
      console.error("[google] could not read jobs for sync:", jobsError.message);
      readFailure = "failed";
    }

    const customerIdsForJobs = [
      ...new Set((jobs ?? []).map((job) => job.customer_id as string | null).filter(Boolean)),
    ] as string[];
    const customersById = new Map<string, Record<string, unknown>>();
    if (customerIdsForJobs.length > 0) {
      const { data: related, error: relatedError } = await admin
        .from("customers")
        .select("id, name, phone, email, preferred_locale")
        .in("id", customerIdsForJobs);
      if (relatedError) {
        console.error("[google] could not read customers for jobs:", relatedError.message);
        readFailure = "failed";
      }
      for (const customer of related ?? []) {
        customersById.set(customer.id as string, customer as Record<string, unknown>);
      }
    }

    for (const job of jobs ?? []) {
      const customer = (job.customer_id
        ? (customersById.get(job.customer_id as string) ?? null)
        : null) as { name?: string; phone?: string; email?: string; preferred_locale?: string } | null;
      rowsByTab.jobs.push(
        jobToRow(
          {
            id: job.id as string,
            status: job.status as string,
            createdAt: job.created_at as string,
            updatedAt: job.updated_at as string,
            customerName: customer?.name ?? null,
            customerPhone: customer?.phone ?? null,
            customerEmail: customer?.email ?? null,
            customerLocale: customer?.preferred_locale ?? null,
            service: (job.service as string | null) ?? null,
            title: job.title as string,
            description: (job.description as string | null) ?? null,
            leadSource: (job.source as string | null) ?? null,
            priority: job.priority as string,
            address: (job.address as string | null) ?? null,
            scheduledStart: (job.scheduled_start as string | null) ?? null,
            estimateAmount: (job.estimate_amount as string | null) ?? null,
            jobTotal: (job.job_total as string | null) ?? null,
            materialsCost: (job.materials_cost as string | null) ?? null,
            paymentStatus: job.payment_status as string,
            assignedTo: null,
            lastFollowUpAt: (job.last_follow_up_at as string | null) ?? null,
            reviewRequestedAt: (job.review_requested_at as string | null) ?? null,
            notes: (job.notes as string | null) ?? null,
            deletedAt: (job.deleted_at as string | null) ?? null,
          },
          context,
        ),
      );
      rendered.add(job.id as string);
    }
  }

  if (customerIds.length > 0) {
    const { data: customers, error: customersError } = await admin
      .from("customers")
      .select(
        "id, name, phone, email, preferred_locale, address, lead_source, notes, updated_at",
      )
      .in("id", customerIds);

    if (customersError) {
      console.error("[google] could not read customers for sync:", customersError.message);
      readFailure = "failed";
    }

    for (const customer of customers ?? []) {
      rowsByTab.customers.push(
        customerToRow(
          {
            id: customer.id as string,
            name: customer.name as string,
            phone: (customer.phone as string | null) ?? null,
            email: (customer.email as string | null) ?? null,
            preferredLocale: (customer.preferred_locale as string | null) ?? null,
            address: (customer.address as string | null) ?? null,
            leadSource: (customer.lead_source as string | null) ?? null,
            // Aggregates arrive with the Customers screen (§14.7.2); writing a
            // wrong number now would be worse than leaving the column empty.
            firstJobDate: null,
            lastJobDate: null,
            totalJobs: 0,
            totalRevenue: null,
            notes: (customer.notes as string | null) ?? null,
            updatedAt: customer.updated_at as string,
          },
          context,
        ),
      );
      rendered.add(customer.id as string);
    }
  }

  const tabMapping = (sheet.tab_mapping ?? {}) as Record<string, number>;
  const spreadsheetId = sheet.spreadsheet_id as string;
  let failure: SheetsFailure | null = readFailure;

  for (const key of ["jobs", "customers"] as const) {
    const rows = rowsByTab[key];
    if (rows.length === 0) continue;

    const title = tabTitle(key, locale);
    // The tab may have been renamed by the owner; the mapping is by id, so
    // fall back to whichever title the mapping knows for this position.
    const resolvedTitle =
      title in tabMapping
        ? title
        : (Object.keys(tabMapping).find((candidate) =>
            key === "jobs" ? tabMapping[candidate] === 0 : tabMapping[candidate] === 1,
          ) ?? title);

    const width = headerRow(key, locale).length;
    const idColumn = await readIdColumn(spreadsheetId, resolvedTitle, token.accessToken);
    if (!idColumn.ok) {
      failure = idColumn.reason;
      break;
    }

    const plan = planWrites(idColumn.value, rows);
    const written = await writeRows(
      spreadsheetId,
      resolvedTitle,
      width,
      plan,
      token.accessToken,
    );
    if (!written.ok) {
      failure = written.reason;
      break;
    }
  }

  // Record outcomes per event, because attempts differ per event.
  const result: SyncRunResult = { ...empty, claimed: due.length };
  const now = Date.now();

  for (const event of due) {
    const attempts = (event.attempts as number) ?? 0;
    const outcome = eventOutcome(failure, attempts, rendered.has(event.entity_id as string));
    result[outcome === "synced" ? "synced" : outcome] += 1;

    await admin
      .from("sync_outbox")
      .update(
        outcome === "synced"
          ? { status: "synced", processed_at: new Date().toISOString(), last_error: null }
          : {
              status: outcome,
              attempts: attempts + 1,
              last_error: failure,
              next_attempt_at: new Date(now + backoffMs(attempts + 1)).toISOString(),
            },
      )
      .eq("id", event.id as string);
  }

  if (failure === null) {
    await admin
      .from("google_spreadsheets")
      .update({ last_successful_sync_at: new Date().toISOString(), last_error: null })
      .eq("id", sheet.id as string);
  } else if (failure === "unauthorized") {
    const { data: connection } = await admin
      .from("google_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (connection) await markConnectionNeedsReconnect(connection.id as string, "reconnect_required");
  } else if (failure === "not_found") {
    // §14.14: the spreadsheet is gone. The data is not, and the settings screen
    // says exactly that.
    await admin
      .from("google_spreadsheets")
      .update({ status: "unavailable", last_error: "not_found" })
      .eq("id", sheet.id as string);
  }

  return result;
}

async function readIdColumn(
  spreadsheetId: string,
  title: string,
  accessToken: string,
): Promise<{ ok: true; value: string[] } | { ok: false; reason: SheetsFailure }> {
  const range = `'${title.replace(/'/g, "''")}'!A2:A`;
  try {
    const response = await fetch(
      `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) return { ok: false, reason: failureFor(response.status) };
    const body = (await response.json()) as { values?: string[][] };
    return { ok: true, value: (body.values ?? []).map((row) => row[0] ?? "") };
  } catch {
    return { ok: false, reason: "rate_limited" };
  }
}

async function writeRows(
  spreadsheetId: string,
  title: string,
  width: number,
  plan: ReturnType<typeof planWrites>,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; reason: SheetsFailure }> {
  try {
    if (plan.updates.length > 0) {
      const response = await fetch(
        `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: plan.updates.map((update) => ({
              range: rowRange(title, update.rowNumber, width),
              values: [update.values],
            })),
          }),
        },
      );
      if (!response.ok) return { ok: false, reason: failureFor(response.status) };
    }

    if (plan.appends.length > 0) {
      const range = `'${title.replace(/'/g, "''")}'!A1`;
      const response = await fetch(
        `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: plan.appends }),
        },
      );
      if (!response.ok) return { ok: false, reason: failureFor(response.status) };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "rate_limited" };
  }
}

export { MAX_ATTEMPTS };
