import { NextResponse, type NextRequest } from "next/server";

import { exchangeCodeForTokens, type GoogleOAuthFailure } from "@/features/google/oauth";
import { backfillOrganization, storeGoogleConnection } from "@/features/google/service";
import { verifyOAuthState } from "@/features/google/state";
import { getCurrentMembership } from "@/features/organizations/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { OAUTH_STATE_COOKIE } from "../connect/route";

export const runtime = "nodejs";

/**
 * GET /api/google/callback (§24).
 *
 * The path is fixed: exactly two redirect URIs are registered with Google (the
 * production domain and localhost), and Google refuses anything else. That also
 * means this leg cannot be exercised from a preview deployment — its host is
 * dynamic — so end-to-end verification happens on production or localhost.
 *
 * Google sends the user here, so every outcome ends in a redirect carrying a
 * short reason code that the settings screen turns into a sentence (§29). No
 * raw error is shown, and nothing here renders HTML of its own.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const stateSecret = process.env.GOOGLE_CLIENT_SECRET;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const cookieNonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null;
  const state = stateSecret
    ? verifyOAuthState(url.searchParams.get("state"), cookieNonce, stateSecret)
    : null;

  // The locale is only trusted once the state's signature checks out; before
  // that it is an attacker-controlled string, so fall back to English.
  const locale = state?.locale === "es" ? "es" : "en";

  const finish = (reason: string) => {
    const target = new URL(`/${locale}/app/settings/google`, url.origin);
    target.searchParams.set("google", reason);
    const response = NextResponse.redirect(target, { status: 303 });
    // The state is single-use whatever happened.
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };

  if (!clientId || !stateSecret || !redirectUri) return finish("not_configured");

  // The user pressed "Cancel" on the consent screen. Not an error, and it must
  // not read like one.
  const googleError = url.searchParams.get("error");
  if (googleError === "access_denied") return finish("access_denied");
  if (googleError) return finish("failed");

  if (!state) return finish("failed");

  const code = url.searchParams.get("code");
  if (!code) return finish("failed");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finish("signed_out");

  const membership = await getCurrentMembership(supabase);
  if (!membership || membership.role !== "owner") return finish("owner_only");

  const exchanged = await exchangeCodeForTokens({
    code,
    clientId,
    clientSecret: stateSecret,
    redirectUri,
  });
  if (!exchanged.ok) return finish(reasonFor(exchanged.reason));

  const stored = await storeGoogleConnection(membership.organizationId, exchanged.value);
  if (!stored.ok) return finish(stored.reason === "not_configured" ? "not_configured" : "failed");

  // §14.5: reconnect performs a backfill. While the connection was broken the
  // queue was parked, and we cannot know what the sheet missed — so everything
  // is queued again rather than guessed at. Writes are keyed by UUID (§14.8),
  // so re-sending a row that is already there costs a call, not a duplicate.
  await backfillOrganization(membership.organizationId);

  return finish("connected");
}

/** Maps an exchange failure to the code the settings screen understands. */
function reasonFor(failure: GoogleOAuthFailure): string {
  switch (failure) {
    case "access_denied":
      return "access_denied";
    case "no_refresh_token":
      return "no_refresh_token";
    case "insufficient_scope":
      return "insufficient_scope";
    case "not_configured":
      return "not_configured";
    default:
      return "failed";
  }
}
