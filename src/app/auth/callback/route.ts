import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Only same-origin paths — a caller-supplied origin must never win. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/en/app";
  return raw;
}

/**
 * Auth code exchange for magic links, email confirmation and OAuth (§10.1).
 * The `next` parameter is restricted to same-origin paths.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const localePrefix = next.startsWith("/es") ? "es" : "en";
  const signInPath = localePrefix === "es" ? "/es/iniciar-sesion" : "/en/sign-in";
  return NextResponse.redirect(new URL(`${signInPath}?error=auth`, request.url));
}
