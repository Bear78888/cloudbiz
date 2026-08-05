import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership } from "@/features/organizations/service";
import { runSyncForOrganization } from "@/features/google/worker";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// A sync pass talks to Google several times; the default budget is too tight.
export const maxDuration = 60;

/**
 * POST /api/google/sync-now (§24, §14.13).
 *
 * The manual trigger. The queue is filled by triggers on every write (§14.9),
 * so this only pulls the schedule forward — it never becomes the only way rows
 * reach the sheet, which is what makes a missed click harmless.
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
  // Staff may look at the sync status but not drive it (§11.3).
  if (membership.role !== "owner") return finish("owner_only");

  const result = await runSyncForOrganization(membership.organizationId);

  if (result.reason === "no_spreadsheet") return finish("no_spreadsheet");
  if (result.reason === "token") return finish("reconnect_required");
  if (result.reason === "nothing_due") return finish("sync_nothing_due");
  if (result.disconnected > 0) return finish("reconnect_required");
  if (result.failed > 0 || result.retrying > 0) return finish("sync_partial");

  return finish("sync_done");
}
