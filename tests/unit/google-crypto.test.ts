import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  GoogleTokenDecryptionError,
  GoogleTokenKeyMissingError,
  decryptRefreshToken,
  encryptRefreshToken,
  readKeyVersion,
} from "@/features/google/crypto";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");
const TOKEN = "1//0gFakeRefreshTokenValueForTests-0123456789abcdef";

describe("Google refresh token encryption", () => {
  it("round-trips a token", () => {
    const { ciphertext, keyVersion } = encryptRefreshToken(TOKEN, KEY);
    expect(keyVersion).toBe(1);
    expect(decryptRefreshToken(ciphertext, KEY)).toBe(TOKEN);
  });

  it("never stores the token in readable form", () => {
    const { ciphertext } = encryptRefreshToken(TOKEN, KEY);
    expect(ciphertext).not.toContain(TOKEN);
    // The CHECK constraint on google_oauth_tokens rejects anything starting
    // with Google's "1//" prefix; the envelope must not trip it.
    expect(ciphertext.startsWith("1//")).toBe(false);
    expect(ciphertext.startsWith("v1:")).toBe(true);
  });

  it("produces a different ciphertext every time (fresh IV)", () => {
    const a = encryptRefreshToken(TOKEN, KEY).ciphertext;
    const b = encryptRefreshToken(TOKEN, KEY).ciphertext;
    expect(a).not.toBe(b);
    expect(decryptRefreshToken(a, KEY)).toBe(decryptRefreshToken(b, KEY));
  });

  // The case the owner asked about: a key that no longer matches must fail
  // as a typed, recognisable error so the caller can say "reconnect Google"
  // instead of returning a 500 (§29).
  it("fails with a typed error under the wrong key", () => {
    const { ciphertext } = encryptRefreshToken(TOKEN, KEY);
    expect(() => decryptRefreshToken(ciphertext, OTHER_KEY)).toThrow(GoogleTokenDecryptionError);
  });

  it("fails with a typed error on tampered or truncated data", () => {
    const { ciphertext } = encryptRefreshToken(TOKEN, KEY);
    const [v, iv, tag, data] = ciphertext.split(":");

    // Flipped payload: GCM authentication catches it.
    const flipped = [v, iv, tag, `${data.slice(0, -2)}AA`].join(":");
    expect(() => decryptRefreshToken(flipped, KEY)).toThrow(GoogleTokenDecryptionError);

    // Wrong shape entirely — e.g. a plaintext token written straight into the
    // column by some future code path.
    expect(() => decryptRefreshToken(TOKEN, KEY)).toThrow(GoogleTokenDecryptionError);
    expect(() => decryptRefreshToken("", KEY)).toThrow(GoogleTokenDecryptionError);
  });

  it("does not leak the reason for a decryption failure", () => {
    const { ciphertext } = encryptRefreshToken(TOKEN, KEY);
    try {
      decryptRefreshToken(ciphertext, OTHER_KEY);
      expect.unreachable("decryption should have failed");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(TOKEN);
      expect(message).not.toContain(KEY);
      expect(message).not.toContain(OTHER_KEY);
    }
  });

  it("rejects a missing or wrong-sized key loudly", () => {
    expect(() => encryptRefreshToken(TOKEN, undefined)).toThrow(GoogleTokenKeyMissingError);
    // A short key would silently weaken encryption; that must not be possible.
    expect(() => encryptRefreshToken(TOKEN, randomBytes(16).toString("base64"))).toThrow(
      /32 bytes/,
    );
  });

  it("refuses to encrypt nothing", () => {
    expect(() => encryptRefreshToken("", KEY)).toThrow(/empty refresh token/);
  });

  it("exposes the key version for a future re-encryption pass", () => {
    const { ciphertext } = encryptRefreshToken(TOKEN, KEY);
    expect(readKeyVersion(ciphertext)).toBe(1);
    expect(readKeyVersion("not-an-envelope")).toBeNull();
  });
});
