import { describe, expect, it } from "vitest";

import { authErrorMessageKey, type AuthErrorLike } from "@/features/auth/errors";
import { en } from "@/lib/i18n/en";

/**
 * Supabase's Pro plan rejects passwords found in known breaches. Before this
 * mapping every such rejection showed "something went wrong", which tells the
 * user nothing and leaves them retyping the same compromised password.
 */

describe("auth error messages (§29)", () => {
  it("names the breached-password case so the user knows what to change", () => {
    expect(
      authErrorMessageKey({ code: "weak_password", reasons: ["pwned"] }),
    ).toBe("passwordLeaked");
    // Older releases only say it in the message.
    expect(
      authErrorMessageKey({
        code: "weak_password",
        message: "Password is known to be weak and easy to guess, please choose a different one.",
      }),
    ).toBe("passwordLeaked");
  });

  it("distinguishes too short from merely weak", () => {
    expect(authErrorMessageKey({ code: "weak_password", reasons: ["length"] })).toBe(
      "passwordTooShort",
    );
    expect(
      authErrorMessageKey({ message: "Password should be at least 8 characters" }),
    ).toBe("passwordTooShort");
    expect(
      authErrorMessageKey({ code: "weak_password", reasons: ["characters"] }),
    ).toBe("passwordWeak");
  });

  it("maps the everyday sign-up and sign-in failures", () => {
    expect(authErrorMessageKey({ code: "user_already_exists" })).toBe("emailTaken");
    expect(authErrorMessageKey({ code: "email_exists" })).toBe("emailTaken");
    expect(authErrorMessageKey({ code: "invalid_credentials" })).toBe("invalidCredentials");
    expect(authErrorMessageKey({ code: "email_not_confirmed" })).toBe("invalidCredentials");
    expect(authErrorMessageKey({ code: "email_address_invalid" })).toBe("emailInvalid");
    expect(authErrorMessageKey({ code: "signup_disabled" })).toBe("notConfigured");
  });

  it("does not call a rate limit a wrong password", () => {
    expect(authErrorMessageKey({ code: "over_request_rate_limit" })).toBe("rateLimited");
    expect(authErrorMessageKey({ code: "over_email_send_rate_limit" })).toBe("rateLimited");
    expect(authErrorMessageKey({ status: 429 })).toBe("rateLimited");
  });

  it("falls back to the generic message for anything unrecognised", () => {
    expect(authErrorMessageKey({ code: "something_new" })).toBe("genericError");
    expect(authErrorMessageKey({})).toBe("genericError");
    expect(authErrorMessageKey(null)).toBe("genericError");
    expect(authErrorMessageKey(undefined)).toBe("genericError");
  });

  it("never leaks the provider's own wording to the user", () => {
    const raw: AuthErrorLike = {
      code: "weak_password",
      message: "AuthWeakPasswordError: pwned at 12345 occurrences",
      reasons: ["pwned"],
    };
    const text = en.platform.authFlow[authErrorMessageKey(raw)];
    expect(text).toBeTruthy();
    expect(text).not.toContain("AuthWeakPasswordError");
    expect(text).not.toContain("pwned");
  });

  it("every key the mapper can return exists in the dictionary", () => {
    const samples: AuthErrorLike[] = [
      { code: "weak_password", reasons: ["pwned"] },
      { code: "weak_password", reasons: ["length"] },
      { code: "weak_password" },
      { code: "user_already_exists" },
      { code: "email_address_invalid" },
      { code: "invalid_credentials" },
      { code: "signup_disabled" },
      { code: "over_request_rate_limit" },
      {},
    ];
    for (const sample of samples) {
      expect(en.platform.authFlow[authErrorMessageKey(sample)]).toBeTruthy();
    }
  });
});
