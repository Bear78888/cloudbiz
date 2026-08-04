import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption of Google refresh tokens at rest (§14.4 step 5, §33).
 *
 * AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
 * decrypt instead of yielding plausible garbage. The key lives only in
 * `GOOGLE_TOKEN_ENCRYPTION_KEY` — never in the database — so a database dump on
 * its own does not yield tokens.
 *
 * The envelope is `v<version>:<iv>:<authTag>:<ciphertext>`, all base64url. The
 * version is inside the payload as well as in the row's `key_version` column:
 * the column is what a re-encryption job would scan by, the prefix is what
 * makes a single value self-describing when it turns up somewhere on its own.
 */

const CURRENT_KEY_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard; 96 bits is what the mode is specified for.
const KEY_BYTES = 32;

/** Decryption failed. Carries no detail about why — see `GoogleTokenDecryptionError`. */
export class GoogleTokenDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleTokenDecryptionError";
  }
}

export class GoogleTokenKeyMissingError extends Error {
  constructor() {
    super("GOOGLE_TOKEN_ENCRYPTION_KEY is not set");
    this.name = "GoogleTokenKeyMissingError";
  }
}

/**
 * Reads and validates the key. `openssl rand -base64 32` gives 44 characters
 * decoding to 32 bytes; anything else is rejected loudly at the point of use,
 * because a short key silently weakening encryption is worse than a crash.
 */
function readKey(raw: string | undefined): Buffer {
  if (!raw) throw new GoogleTokenKeyMissingError();
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`,
    );
  }
  return key;
}

export interface EncryptedToken {
  ciphertext: string;
  keyVersion: number;
}

export function encryptRefreshToken(
  plaintext: string,
  keyMaterial: string | undefined = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
): EncryptedToken {
  if (!plaintext) throw new Error("refusing to encrypt an empty refresh token");
  const key = readKey(keyMaterial);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: [
      `v${CURRENT_KEY_VERSION}`,
      iv.toString("base64url"),
      authTag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join(":"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/**
 * Throws `GoogleTokenDecryptionError` on a wrong key, a truncated value or any
 * tampering. Callers must translate that into "reconnect Google" rather than a
 * 500 (§29): the user cannot fix a key problem, but they can reconnect, and
 * that is the only sentence worth showing them.
 */
export function decryptRefreshToken(
  envelope: string,
  keyMaterial: string | undefined = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
): string {
  const key = readKey(keyMaterial);
  const parts = envelope.split(":");
  if (parts.length !== 4 || !parts[0].startsWith("v")) {
    throw new GoogleTokenDecryptionError("stored token is not in the expected envelope format");
  }

  const [, ivPart, tagPart, dataPart] = parts;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    if (!plaintext) {
      throw new GoogleTokenDecryptionError("decrypted token is empty");
    }
    return plaintext;
  } catch (error) {
    if (error instanceof GoogleTokenDecryptionError) throw error;
    // The underlying message ("Unsupported state or unable to authenticate
    // data") tells an attacker nothing useful and a reader nothing actionable.
    throw new GoogleTokenDecryptionError("stored token could not be decrypted");
  }
}

/** Parsed key version, for a future re-encryption pass. */
export function readKeyVersion(envelope: string): number | null {
  const prefix = envelope.split(":")[0];
  if (!prefix?.startsWith("v")) return null;
  const parsed = Number.parseInt(prefix.slice(1), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
