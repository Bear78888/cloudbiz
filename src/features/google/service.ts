import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  GoogleTokenDecryptionError,
  GoogleTokenKeyMissingError,
  decryptRefreshToken,
  encryptRefreshToken,
} from "./crypto";
import { refreshAccessToken, type GoogleTokenSet } from "./oauth";

/**
 * Google connection storage (§14.4, §25.8).
 *
 * Every write here goes through the service-role client: `google_oauth_tokens`
 * has no grant for any client role by design, so the session client cannot
 * reach it even with a valid membership. This is the elevated trust level
 * (§26.1) used exactly where it is meant to be — server code the user never
 * controls the input of.
 */

export type GoogleConnectionStatus = "active" | "needs_reconnect" | "revoked";

export interface GoogleConnectionSummary {
  id: string;
  email: string | null;
  status: GoogleConnectionStatus;
  connectedAt: string;
  /** Set when the connection needs attention; already a dictionary key. */
  problem: GoogleConnectionProblem | null;
}

/** What is wrong, in terms the settings screen can turn into a sentence (§29). */
export type GoogleConnectionProblem = "reconnect_required" | "token_unreadable";

/**
 * Reads the organization's connection. Uses the caller's session client: the
 * metadata table is readable by members through RLS, and nothing secret lives
 * in it.
 */
export async function getGoogleConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<GoogleConnectionSummary | null> {
  const { data, error } = await supabase
    .from("google_connections")
    .select("id, email, status, connected_at, last_error")
    .eq("organization_id", organizationId)
    .in("status", ["active", "needs_reconnect"])
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[google] connection lookup failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id as string,
    email: (data.email as string | null) ?? null,
    status: data.status as GoogleConnectionStatus,
    connectedAt: data.connected_at as string,
    problem:
      data.status === "needs_reconnect"
        ? ((data.last_error as GoogleConnectionProblem | null) ?? "reconnect_required")
        : null,
  };
}

/**
 * Stores a freshly authorised connection, replacing whatever came before.
 *
 * Replacing rather than adding: §14.5 allows one active connection per
 * organization, and the partial unique index enforces it. Reconnecting with a
 * different Google account is a legitimate action (the owner changed accounts),
 * so the old row is retired instead of blocking the new one.
 */
export async function storeGoogleConnection(
  organizationId: string,
  tokens: GoogleTokenSet,
): Promise<{ ok: true; connectionId: string } | { ok: false; reason: "not_configured" | "failed" }> {
  let encrypted;
  try {
    encrypted = encryptRefreshToken(tokens.refreshToken);
  } catch (error) {
    if (error instanceof GoogleTokenKeyMissingError) {
      console.error("[google] GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
      return { ok: false, reason: "not_configured" };
    }
    console.error("[google] refusing to store a token that could not be encrypted");
    return { ok: false, reason: "failed" };
  }

  const admin = createSupabaseAdminClient();

  // Retire any previous connection first: the partial unique index allows only
  // one active row, and the retired row keeps its history.
  const { error: retireError } = await admin
    .from("google_connections")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .in("status", ["active", "needs_reconnect"]);
  if (retireError) {
    console.error("[google] could not retire the previous connection:", retireError.message);
    return { ok: false, reason: "failed" };
  }

  const { data: connection, error: insertError } = await admin
    .from("google_connections")
    .insert({
      organization_id: organizationId,
      google_subject: tokens.googleSubject,
      email: tokens.email,
      scopes: tokens.scopes,
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !connection) {
    console.error("[google] could not store the connection:", insertError?.message);
    return { ok: false, reason: "failed" };
  }

  const connectionId = connection.id as string;
  const { error: tokenError } = await admin.from("google_oauth_tokens").upsert(
    {
      connection_id: connectionId,
      organization_id: organizationId,
      encrypted_refresh_token: encrypted.ciphertext,
      key_version: encrypted.keyVersion,
    },
    { onConflict: "connection_id" },
  );

  if (tokenError) {
    // A connection row without a token would look connected and never sync.
    // Roll it back rather than leave that contradiction in the database.
    console.error("[google] could not store the refresh token:", tokenError.message);
    await admin.from("google_connections").delete().eq("id", connectionId);
    return { ok: false, reason: "failed" };
  }

  return { ok: true, connectionId };
}

/** Marks a connection as needing the user's attention, with a reason. */
export async function markConnectionNeedsReconnect(
  connectionId: string,
  problem: GoogleConnectionProblem,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("google_connections")
    .update({ status: "needs_reconnect", last_error: problem })
    .eq("id", connectionId);
  if (error) {
    console.error("[google] could not flag the connection for reconnect:", error.message);
  }
}

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: GoogleConnectionProblem | "not_configured" | "no_connection" | "transient" };

/**
 * Produces an access token for the organization's active connection.
 *
 * The failure the owner asked about: if the stored ciphertext cannot be
 * decrypted — a rotated key, a corrupted value — the connection is flagged
 * `needs_reconnect` and the caller gets a reason it can turn into "connect
 * Google again" (§29). It is deliberately not an exception: the user cannot
 * fix a key, they can reconnect, and a 500 tells them neither.
 *
 * This is also why `GOOGLE_TOKEN_ENCRYPTION_KEY` is not a routinely rotatable
 * secret: rotating it makes every stored token unreadable at once, and every
 * customer would have to reconnect Google by hand. See the launch checklist —
 * it is an explicit exception to the key rotation done at the domain move.
 */
export async function getAccessTokenForOrganization(
  organizationId: string,
): Promise<AccessTokenResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ok: false, reason: "not_configured" };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("google_connections")
    .select("id, google_oauth_tokens (encrypted_refresh_token)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[google] token lookup failed:", error.message);
    return { ok: false, reason: "transient" };
  }
  if (!data) return { ok: false, reason: "no_connection" };

  const connectionId = data.id as string;
  const tokenRows = data.google_oauth_tokens as { encrypted_refresh_token: string }[] | null;
  const ciphertext = Array.isArray(tokenRows)
    ? tokenRows[0]?.encrypted_refresh_token
    : (tokenRows as { encrypted_refresh_token: string } | null)?.encrypted_refresh_token;

  if (!ciphertext) {
    await markConnectionNeedsReconnect(connectionId, "reconnect_required");
    return { ok: false, reason: "reconnect_required" };
  }

  let refreshToken: string;
  try {
    refreshToken = decryptRefreshToken(ciphertext);
  } catch (decryptionError) {
    if (decryptionError instanceof GoogleTokenKeyMissingError) {
      // Not the user's problem and not fixable by reconnecting: the server is
      // misconfigured. Say so distinctly instead of sending them in a loop.
      console.error("[google] GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
      return { ok: false, reason: "not_configured" };
    }
    if (decryptionError instanceof GoogleTokenDecryptionError) {
      console.error("[google] stored refresh token could not be decrypted; reconnect required");
      await markConnectionNeedsReconnect(connectionId, "token_unreadable");
      return { ok: false, reason: "token_unreadable" };
    }
    throw decryptionError;
  }

  const refreshed = await refreshAccessToken({ refreshToken, clientId, clientSecret });
  if (!refreshed.ok) {
    if (refreshed.reason === "revoked") {
      await markConnectionNeedsReconnect(connectionId, "reconnect_required");
      return { ok: false, reason: "reconnect_required" };
    }
    // Transient: the worker backs off and retries (§14.11) rather than telling
    // the user to reconnect a connection that is fine.
    return { ok: false, reason: "transient" };
  }

  return { ok: true, accessToken: refreshed.accessToken };
}
