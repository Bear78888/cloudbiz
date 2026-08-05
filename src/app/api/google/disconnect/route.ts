import { NextResponse, type NextRequest } from "next/server";

import { disconnectGoogle } from "@/features/google/service";
import { getCurrentMembership } from "@/features/organizations/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/google/disconnect (§24, §14.5).
 *
 * Owner-only (§11.3). The spreadsheet is left in the owner's Drive untouched —
 * §14.5 says so, and it is their file: what is disconnected is our access to
 * it, not their copy of the data.
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

  const result = await disconnectGoogle(membership.organizationId);
  return finish(result.ok ? "disconnected" : "failed");
}
