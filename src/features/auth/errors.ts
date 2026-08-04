/**
 * Supabase auth errors → dictionary keys (§29: never show the provider's raw
 * message). Pure and framework-free so the mapping is unit-tested rather than
 * discovered in production.
 *
 * The leaked-password case matters as of the Pro plan: Supabase checks new
 * passwords against HaveIBeenPwned and rejects them. Without this mapping the
 * user is told "something went wrong" and retypes the same compromised
 * password forever.
 */

export type AuthFlowMessageKey =
  | "invalidCredentials"
  | "passwordTooShort"
  | "passwordLeaked"
  | "passwordWeak"
  | "emailTaken"
  | "emailInvalid"
  | "rateLimited"
  | "notConfigured"
  | "genericError";

/** The shape of `AuthError` we rely on; kept structural so tests need no SDK. */
export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  /** Present on Supabase's AuthWeakPasswordError. */
  reasons?: string[] | null;
}

/**
 * Supabase reports "this password is in a breach corpus" as a weak-password
 * error whose reasons include `pwned`. Older releases only say so in the
 * message, so both are checked — and the phrasing check is deliberately loose.
 */
function isLeaked(error: AuthErrorLike): boolean {
  if (error.reasons?.includes("pwned")) return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("pwned") || message.includes("known to be weak");
}

export function authErrorMessageKey(error: AuthErrorLike | null | undefined): AuthFlowMessageKey {
  if (!error) return "genericError";

  const code = error.code ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (code === "weak_password" || message.includes("password should be")) {
    if (isLeaked(error)) return "passwordLeaked";
    if (error.reasons?.includes("length") || message.includes("at least")) {
      return "passwordTooShort";
    }
    return "passwordWeak";
  }
  if (isLeaked(error)) return "passwordLeaked";

  if (code === "user_already_exists" || code === "email_exists") return "emailTaken";
  if (code === "email_address_invalid" || code === "validation_failed") return "emailInvalid";
  if (code === "invalid_credentials" || code === "email_not_confirmed") {
    return "invalidCredentials";
  }
  if (code === "signup_disabled" || code === "email_provider_disabled") return "notConfigured";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429
  ) {
    return "rateLimited";
  }

  return "genericError";
}
