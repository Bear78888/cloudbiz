/**
 * Supabase target guard (pattern per audit §4.2): elevated (service-role)
 * access derives its origin from a server-owned, verified project ref —
 * never from NEXT_PUBLIC_SUPABASE_URL, which a Vercel Marketplace
 * integration can overwrite with another project's credentials.
 *
 * TODO(owner): once the dedicated HandyAlliance Supabase project exists
 * (§00.0.5 — awaited from the owner; it must NOT be a BizMetria project),
 * pin its ref in CANONICAL_SUPABASE_PROJECT_REF. Until then the guard runs
 * in bootstrap mode: it accepts the server-owned SUPABASE_PROJECT_REF but
 * still refuses any mismatch with the public URL, and refuses the known
 * BizMetria refs outright so platform code can never write to that product.
 */
export const CANONICAL_SUPABASE_PROJECT_REF: string | null = null;

/** BizMetria projects are read-only reference material (§00.0.1.4) — never a platform target. */
export const FORBIDDEN_PROJECT_REFS: readonly string[] = Object.freeze([
  "rbndiytodvoyiejassnw",
  "bwmyzkufqrufjimtfwow",
]);

export const REGISTERED_PREVIEW_PROJECT_REFS: readonly string[] = Object.freeze([]);

const SUPABASE_TARGET_ERROR = "Supabase target mismatch.";

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

// `detail` may only carry non-secret identifiers (project refs, hostnames).
export function failSupabaseTargetVerification(detail?: string): never {
  throw new Error(detail ? `${SUPABASE_TARGET_ERROR} ${detail}` : SUPABASE_TARGET_ERROR);
}

function isRegisteredPreviewTarget(environment: EnvironmentInput): boolean {
  return (
    environment.SUPABASE_TARGET_ENV === "preview" &&
    typeof environment.SUPABASE_PROJECT_REF === "string" &&
    REGISTERED_PREVIEW_PROJECT_REFS.includes(environment.SUPABASE_PROJECT_REF)
  );
}

export function resolveExpectedSupabaseProjectRef(
  environment: EnvironmentInput = process.env,
): string {
  if (CANONICAL_SUPABASE_PROJECT_REF !== null) {
    if (isRegisteredPreviewTarget(environment)) {
      return environment.SUPABASE_PROJECT_REF as string;
    }
    return CANONICAL_SUPABASE_PROJECT_REF;
  }

  // Bootstrap mode: no canonical ref pinned yet. Accept the server-owned ref
  // as long as it is present and not a forbidden (BizMetria) project.
  const ref = environment.SUPABASE_PROJECT_REF;
  if (typeof ref !== "string" || ref.length === 0) {
    failSupabaseTargetVerification("SUPABASE_PROJECT_REF is unset.");
  }
  if (FORBIDDEN_PROJECT_REFS.includes(ref)) {
    failSupabaseTargetVerification(
      `Ref ${ref} is a BizMetria project and is forbidden as a platform target.`,
    );
  }
  return ref;
}

function describeObservedTarget(environment: EnvironmentInput): string {
  return `Received ref: ${environment.SUPABASE_PROJECT_REF ?? "(unset)"}, target env: ${environment.SUPABASE_TARGET_ENV ?? "(unset)"}.`;
}

export function verifySupabaseProjectRef(environment: EnvironmentInput = process.env): string {
  const expectedRef = resolveExpectedSupabaseProjectRef(environment);
  if (environment.SUPABASE_PROJECT_REF !== expectedRef) {
    failSupabaseTargetVerification(describeObservedTarget(environment));
  }
  if (FORBIDDEN_PROJECT_REFS.includes(expectedRef)) {
    failSupabaseTargetVerification(
      `Ref ${expectedRef} is a BizMetria project and is forbidden as a platform target.`,
    );
  }
  return expectedRef;
}

/** The single authoritative origin for elevated access, derived from the verified ref. */
export function resolveSupabaseAdminUrl(environment: EnvironmentInput = process.env): string {
  return `https://${verifySupabaseProjectRef(environment)}.supabase.co`;
}

export function verifySupabaseEnvironmentTarget(
  environment: EnvironmentInput = process.env,
): void {
  const expectedRef = verifySupabaseProjectRef(environment);
  const expectedHostname = `${expectedRef}.supabase.co`;
  const observed = describeObservedTarget(environment);

  const projectUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) {
    failSupabaseTargetVerification(`${observed} Project URL is missing.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(projectUrl);
  } catch {
    failSupabaseTargetVerification(`${observed} Project URL is not a valid URL.`);
  }

  const isLocal = parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost";
  if (isLocal) return; // local development stack

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname.toLowerCase() !== expectedHostname ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== ""
  ) {
    failSupabaseTargetVerification(
      `${observed} Expected host: ${expectedHostname}, received host: ${parsedUrl.hostname}.`,
    );
  }
}
