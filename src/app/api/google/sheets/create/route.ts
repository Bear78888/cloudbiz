import { NextResponse, type NextRequest } from "next/server";

import { getAccessTokenForOrganization } from "@/features/google/service";
import { createSpreadsheet } from "@/features/google/sheets";
import { getCurrentMembership } from "@/features/organizations/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/google/sheets/create (§24, §14.4 step 3).
 *
 * Creates the organization's spreadsheet and records it. Owner-only (§11.3).
 *
 * Under `drive.file` the app can only touch files it created, so this is the
 * path that always works; attaching an existing sheet requires the Picker.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const locale = form?.get("locale") === "es" ? "es" : "en";
  const settings = new URL(`/${locale}/app/settings/google`, request.nextUrl.origin);

  const finish = (reason: string) => {
    settings.searchParams.set("google", reason);
    return NextResponse.redirect(settings, { status: 303 });
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finish("signed_out");

  const membership = await getCurrentMembership(supabase);
  if (!membership) return finish("failed");
  if (membership.role !== "owner") return finish("owner_only");

  const token = await getAccessTokenForOrganization(membership.organizationId);
  if (!token.ok) {
    // Each of these is a different sentence to the user; collapsing them into
    // "something went wrong" would hide the one thing they can act on (§29).
    return finish(
      token.reason === "no_connection"
        ? "reconnect_required"
        : token.reason === "transient"
          ? "sheet_temporarily_unavailable"
          : token.reason,
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const created = await createSpreadsheet({
    accessToken: token.accessToken,
    businessName: membership.organizationName,
    locale,
    dashboardUrl: `${appUrl}/${locale}/app`,
  });

  if (!created.ok) {
    if (created.reason === "unauthorized") return finish("reconnect_required");
    if (created.reason === "rate_limited") return finish("sheet_temporarily_unavailable");
    return finish("sheet_create_failed");
  }

  const admin = createSupabaseAdminClient();

  // §14.5: one active spreadsheet per organization. An earlier one becomes
  // `replaced` rather than being deleted — the file stays in the owner's Drive
  // (§14.5: disconnect does not delete the sheet), and the history of what we
  // were mirroring survives.
  const { error: replaceError } = await admin
    .from("google_spreadsheets")
    .update({ status: "replaced" })
    .eq("organization_id", membership.organizationId)
    .eq("status", "active");
  if (replaceError) {
    console.error("[google] could not retire the previous spreadsheet:", replaceError.message);
    return finish("sheet_create_failed");
  }

  const { data: connection } = await admin
    .from("google_connections")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .eq("status", "active")
    .maybeSingle();

  const { error: insertError } = await admin.from("google_spreadsheets").insert({
    organization_id: membership.organizationId,
    connection_id: connection?.id ?? null,
    spreadsheet_id: created.value.spreadsheetId,
    spreadsheet_name: created.value.spreadsheetName,
    tab_mapping: created.value.tabMapping,
    status: "active",
  });

  if (insertError) {
    // The spreadsheet exists in Drive but we failed to record it. Say so
    // plainly instead of pretending it worked — a second attempt creates a
    // second file, and the owner should know why.
    console.error("[google] spreadsheet created but not recorded:", insertError.message);
    return finish("sheet_created_not_recorded");
  }

  return finish("sheet_created");
}
