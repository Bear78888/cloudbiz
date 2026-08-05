import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * CSRF state for the OAuth round trip (§26).
 *
 * The value is `<nonce>.<locale>.<hmac>`, and the same nonce is also put in an
 * httpOnly cookie. On the way back both must agree: the cookie proves the flow
 * started in this browser, the HMAC proves the value was not assembled by
 * someone else. Either alone is weaker — a cookie-only check accepts a state
 * pasted from elsewhere, an HMAC-only check accepts a link a third party
 * prepared and sent to the user.
 *
 * The locale rides along so the callback can send the user back to the screen
 * in the language they started in, rather than guessing.
 */

const SEPARATOR = ".";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export interface OAuthState {
  nonce: string;
  locale: string;
}

export function createOAuthState(locale: string, secret: string): { value: string; nonce: string } {
  const nonce = randomBytes(24).toString("base64url");
  const payload = `${nonce}${SEPARATOR}${locale}`;
  return { value: `${payload}${SEPARATOR}${sign(payload, secret)}`, nonce };
}

/**
 * Returns the state's contents only if the signature is valid and the nonce
 * matches the cookie. Any mismatch returns null — the caller shows the generic
 * "could not connect" and never explains which half failed.
 */
export function verifyOAuthState(
  value: string | null | undefined,
  cookieNonce: string | null | undefined,
  secret: string,
): OAuthState | null {
  if (!value || !cookieNonce) return null;

  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return null;
  const [nonce, locale, signature] = parts;

  const expected = sign(`${nonce}${SEPARATOR}${locale}`, secret);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  const nonceBuf = Buffer.from(nonce);
  const cookieBuf = Buffer.from(cookieNonce);
  if (nonceBuf.length !== cookieBuf.length || !timingSafeEqual(nonceBuf, cookieBuf)) return null;

  return { nonce, locale };
}
