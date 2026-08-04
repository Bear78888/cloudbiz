import { NextResponse, type NextRequest } from "next/server";

import { buildAuthorizationUrl } from "@/features/google/oauth";
import { createOAuthState } from "@/features/google/state";
import { getCurrentMembership } from "@/features/organizations/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const OAUTH_STATE_COOKIE = "ha_google_oauth";

/**
 * POST /api/google/connect (§24). Starts the Google authorisation round trip.
 *
 * Owner-only (§11.3): connecting Google moves the organization's data into an
 * outside account, which is not a staff decision.
 *
 * POST rather than GET, and therefore a form rather than a link: a GET that
 * kicks off an OAuth flow can be triggered by any page that can make the
 * browser navigate.
 */
export async function POST(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const stateSecret = process.env.GOOGLE_CLIENT_SECRET;

  const form = await request.formData().catch(() => null);
  const locale = form?.get("locale") === "es" ? "es" : "en";
  const settingsUrl = new URL(`/${locale}/app/settings/google`, request.nextUrl.origin);

  if (!clientId || !redirectUri || !stateSecret) {
    settingsUrl.searchParams.set("google", "not_configured");
    return NextResponse.redirect(settingsUrl, { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.nextUrl.origin), {
      status: 303,
    });
  }

  const membership = await getCurrentMembership(supabase);
  if (!membership || membership.role !== "owner") {
    settingsUrl.searchParams.set("google", "owner_only");
    return NextResponse.redirect(settingsUrl, { status: 303 });
  }

  const { value, nonce } = createOAuthState(locale, stateSecret);
  const response = NextResponse.redirect(
    buildAuthorizationUrl({ clientId, redirectUri, state: value }),
    { status: 303 },
  );
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax", // must survive the redirect back from Google
    path: "/",
    maxAge: 600, // ten minutes is plenty to click through a consent screen
  });
  return response;
}
