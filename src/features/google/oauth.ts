/**
 * Google OAuth for Sheets sync (§14.4, §24).
 *
 * Pure request-building and response-parsing, with `fetch` injected, so the
 * awkward parts — a refused consent, a response with no refresh token, an
 * expired code — are unit-testable without touching Google.
 */

/**
 * §14.4: "minimally necessary access, preferably drive.file".
 *
 * `drive.file` grants access only to files this app creates or that the user
 * hands over through the Google Picker — not to the user's Drive. That is the
 * whole point, and it has a consequence worth stating: an existing spreadsheet
 * cannot be attached by pasting its id, because under this scope the app has
 * no access to a file the user has not explicitly granted. "Connect an existing
 * sheet" therefore has to go through the Picker (§14.4), not a text field.
 *
 * `spreadsheets` is required to read and write the tabs of the file we are
 * allowed to touch; it does not widen which files those are.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "openid",
  "email",
] as const;

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface AuthUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
}

export function buildAuthorizationUrl({ clientId, redirectUri, state }: AuthUrlInput): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  // A refresh token is only issued for offline access, and Google returns it
  // only on the *first* consent unless prompted again. Sync has to survive the
  // user closing the tab, so both are required — and `prompt=consent` is what
  // makes reconnect (§14.5) actually produce a new token instead of silently
  // returning none.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

/** Why a connection attempt did not result in a usable connection. */
export type GoogleOAuthFailure =
  | "access_denied"
  | "state_mismatch"
  | "missing_code"
  | "no_refresh_token"
  | "insufficient_scope"
  | "exchange_failed"
  | "not_configured";

export interface GoogleTokenSet {
  refreshToken: string;
  accessToken: string;
  expiresInSeconds: number;
  scopes: string[];
  /** Google's stable user id (`sub`); the email can change, this cannot. */
  googleSubject: string;
  email: string | null;
}

export type ExchangeResult =
  | { ok: true; value: GoogleTokenSet }
  | { ok: false; reason: GoogleOAuthFailure };

export interface ExchangeInput {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}

/** Decodes the id_token payload. Signature is not verified — see below. */
function readIdToken(idToken: string | undefined): { sub: string; email: string | null } | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
    if (!decoded.sub) return null;
    return { sub: decoded.sub, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function exchangeCodeForTokens({
  code,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
}: ExchangeInput): Promise<ExchangeResult> {
  let response: Response;
  try {
    response = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
  } catch {
    return { ok: false, reason: "exchange_failed" };
  }

  if (!response.ok) return { ok: false, reason: "exchange_failed" };

  let body: {
    refresh_token?: string;
    access_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return { ok: false, reason: "exchange_failed" };
  }

  if (!body.access_token) return { ok: false, reason: "exchange_failed" };
  // Without a refresh token the connection works until the access token expires
  // and then dies quietly. Better to refuse the connection now, with a sentence
  // the user can act on, than to have sync stop an hour later for no visible
  // reason.
  if (!body.refresh_token) return { ok: false, reason: "no_refresh_token" };

  const granted = (body.scope ?? "").split(" ").filter(Boolean);
  // The consent screen lets the user untick individual scopes. Without
  // drive.file we cannot create or touch the spreadsheet at all, so this is a
  // refusal, not a degraded mode.
  if (!granted.includes("https://www.googleapis.com/auth/drive.file")) {
    return { ok: false, reason: "insufficient_scope" };
  }

  // The id_token comes straight from Google's token endpoint over TLS, in
  // response to a request carrying our client secret — it is not user input,
  // so the signature adds nothing here. It would matter if we accepted an
  // id_token from the browser, which we never do.
  const identity = readIdToken(body.id_token);
  if (!identity) return { ok: false, reason: "exchange_failed" };

  return {
    ok: true,
    value: {
      refreshToken: body.refresh_token,
      accessToken: body.access_token,
      expiresInSeconds: body.expires_in ?? 3600,
      scopes: granted,
      googleSubject: identity.sub,
      email: identity.email,
    },
  };
}

export type RefreshResult =
  | { ok: true; accessToken: string; expiresInSeconds: number }
  | { ok: false; reason: "revoked" | "failed" };

/**
 * Exchanges a refresh token for an access token. A revoked or expired grant is
 * distinguished from a transient failure, because they call for opposite
 * responses: reconnect (the user must act) versus retry (§14.11, the worker
 * backs off and tries again).
 */
export async function refreshAccessToken({
  refreshToken,
  clientId,
  clientSecret,
  fetchImpl = fetch,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<RefreshResult> {
  let response: Response;
  try {
    response = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (response.status === 400 || response.status === 401) {
    // Google answers `invalid_grant` when the user revoked access or the token
    // expired from disuse. Retrying that forever would be pointless noise.
    return { ok: false, reason: "revoked" };
  }
  if (!response.ok) return { ok: false, reason: "failed" };

  try {
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return { ok: false, reason: "failed" };
    return {
      ok: true,
      accessToken: body.access_token,
      expiresInSeconds: body.expires_in ?? 3600,
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
