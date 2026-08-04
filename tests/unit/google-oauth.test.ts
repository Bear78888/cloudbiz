import { describe, expect, it } from "vitest";

import {
  GOOGLE_SCOPES,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "@/features/google/oauth";

const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
const CLIENT_SECRET = "test-client-secret";
const REDIRECT = "https://handyalliance.com/api/google/callback";

function idToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `header.${body}.signature`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const GOOD_BODY = {
  access_token: "ya29.access",
  refresh_token: "1//0refresh",
  expires_in: 3599,
  scope:
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets openid email",
  id_token: idToken({ sub: "108451", email: "owner@example.com" }),
};

describe("authorization URL", () => {
  const url = new URL(buildAuthorizationUrl({ clientId: CLIENT_ID, redirectUri: REDIRECT, state: "s1" }));

  it("asks for offline access and forces consent", () => {
    // Without both, a reconnect returns no refresh token and sync dies the
    // moment the access token expires (§14.5).
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("requests drive.file, not broad Drive access (§14.4)", () => {
    const scopes = (url.searchParams.get("scope") ?? "").split(" ");
    expect(scopes).toContain("https://www.googleapis.com/auth/drive.file");
    expect(scopes).not.toContain("https://www.googleapis.com/auth/drive");
    expect(scopes).not.toContain("https://www.googleapis.com/auth/drive.readonly");
    expect([...GOOGLE_SCOPES]).toEqual(scopes);
  });

  it("carries the redirect URI and state verbatim", () => {
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("state")).toBe("s1");
    // §24: Google rejects any path other than the registered one.
    expect(new URL(REDIRECT).pathname).toBe("/api/google/callback");
  });
});

describe("code exchange", () => {
  const exchange = (body: unknown, status = 200) =>
    exchangeCodeForTokens({
      code: "auth-code",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT,
      fetchImpl: async () => jsonResponse(body, status),
    });

  it("returns the token set on success", async () => {
    const result = await exchange(GOOD_BODY);
    expect(result).toEqual({
      ok: true,
      value: {
        refreshToken: "1//0refresh",
        accessToken: "ya29.access",
        expiresInSeconds: 3599,
        scopes: expect.arrayContaining(["https://www.googleapis.com/auth/drive.file"]),
        googleSubject: "108451",
        email: "owner@example.com",
      },
    });
  });

  // Google omits the refresh token when the user has consented before. A
  // connection without one works until the access token expires and then stops
  // for no visible reason, so it is refused up front.
  it("refuses a response with no refresh token", async () => {
    const { refresh_token: _omitted, ...withoutRefresh } = GOOD_BODY;
    expect(await exchange(withoutRefresh)).toEqual({ ok: false, reason: "no_refresh_token" });
  });

  // The consent screen lets the user untick scopes individually.
  it("refuses when drive.file was not granted", async () => {
    const result = await exchange({
      ...GOOD_BODY,
      scope: "openid email https://www.googleapis.com/auth/spreadsheets",
    });
    expect(result).toEqual({ ok: false, reason: "insufficient_scope" });
  });

  it("reports an exchange failure rather than throwing", async () => {
    expect(await exchange({ error: "invalid_grant" }, 400)).toEqual({
      ok: false,
      reason: "exchange_failed",
    });
    expect(await exchange({ access_token: "a", refresh_token: "r", scope: GOOD_BODY.scope })).toEqual({
      ok: false,
      reason: "exchange_failed",
    });

    const networkDown = await exchangeCodeForTokens({
      code: "auth-code",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT,
      fetchImpl: async () => {
        throw new Error("ECONNRESET");
      },
    });
    expect(networkDown).toEqual({ ok: false, reason: "exchange_failed" });
  });
});

describe("access token refresh", () => {
  const refresh = (status: number, body: unknown = {}) =>
    refreshAccessToken({
      refreshToken: "1//0refresh",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      fetchImpl: async () => jsonResponse(body, status),
    });

  it("returns a fresh access token", async () => {
    expect(await refresh(200, { access_token: "ya29.new", expires_in: 3599 })).toEqual({
      ok: true,
      accessToken: "ya29.new",
      expiresInSeconds: 3599,
    });
  });

  // These two must be distinguishable: one needs the user, the other needs a
  // retry (§14.11). Treating a revoked grant as retryable would spin forever;
  // treating a blip as revoked would demand a reconnect for nothing.
  it("separates a revoked grant from a transient failure", async () => {
    expect(await refresh(400, { error: "invalid_grant" })).toEqual({ ok: false, reason: "revoked" });
    expect(await refresh(401)).toEqual({ ok: false, reason: "revoked" });
    expect(await refresh(500)).toEqual({ ok: false, reason: "failed" });
    expect(await refresh(503)).toEqual({ ok: false, reason: "failed" });
  });
});
