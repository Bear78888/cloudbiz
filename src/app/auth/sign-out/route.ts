import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const form = await request.formData().catch(() => null);
  const rawLocale = form?.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : "en";
  return NextResponse.redirect(new URL(`/${locale}`, request.url), { status: 303 });
}
