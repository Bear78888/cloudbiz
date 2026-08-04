import { NextResponse, type NextRequest } from "next/server";

import { toCsv } from "@/features/jobs/csv";
import { listJobs } from "@/features/jobs/service";
import { parseSort, parseView } from "@/features/jobs/model";
import { getCurrentMembership } from "@/features/organizations/service";
import { isLocale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * CSV export (§13.8). The column order matches the Jobs tab of the managed
 * Google Sheet (§14.7), so an export and a future sync describe a job the
 * same way — and the file opens straight into the spreadsheet people already
 * use. Values are escaped by `csvCell`, which also defuses leading `=`/`+`
 * so a note can never execute as a spreadsheet formula.
 */

const HEADERS = [
  "HandyAlliance Job ID",
  "Status",
  "Created",
  "Updated",
  "Customer",
  "Phone",
  "Email",
  "Language",
  "Job",
  "Service",
  "Description",
  "Lead Source",
  "Priority",
  "Address",
  "Scheduled Date",
  "Estimate Amount",
  "Job Total",
  "Materials Cost",
  "Payment Status",
  "Notes",
  "Deleted",
];

const MAX_EXPORT_PAGES = 40;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) {
    return NextResponse.redirect(new URL(`/${locale}/app`, request.url));
  }

  const query = request.nextUrl.searchParams;
  const view = parseView(query.get("view") ?? undefined);
  const sort = parseSort(query.get("sort") ?? undefined);
  const search = query.get("q")?.trim() || undefined;

  const rows: (string | number | null)[][] = [];
  for (let page = 1; page <= MAX_EXPORT_PAGES; page += 1) {
    const result = await listJobs(supabase, {
      organizationId: membership.organizationId,
      view,
      sort,
      search,
      deleted: false,
      page,
    });

    for (const job of result.jobs) {
      rows.push([
        job.id,
        job.status,
        job.created_at,
        job.updated_at,
        job.customer?.name ?? "",
        job.customer?.phone ?? "",
        job.customer?.email ?? "",
        job.customer?.preferred_locale ?? "",
        job.title,
        job.service ?? "",
        job.description ?? "",
        job.source ?? "",
        job.priority,
        job.address ?? "",
        job.scheduled_start ?? "",
        job.estimate_amount ?? "",
        job.job_total ?? "",
        job.materials_cost ?? "",
        job.payment_status,
        job.notes ?? "",
        job.deleted_at ? "TRUE" : "FALSE",
      ]);
    }

    if (page >= result.pageCount) break;
  }

  const filename = `handyalliance-jobs-${membership.organizationSlug}.csv`;
  return new NextResponse(toCsv(HEADERS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
