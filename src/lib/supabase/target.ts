/**
 * Supabase target guard (pattern per audit §4.2): elevated (service-role)
 * access derives its origin from a server-owned, verified project ref —
 * never from NEXT_PUBLIC_SUPABASE_URL, which a Vercel Marketplace
 * integration can overwrite with another project's credentials.
 *
 * The canonical platform project `handyalliance-platform` was created
 * 2026-08-04 with the owner's permission; its ref is pinned below. The
 * known BizMetria refs are refused outright so platform code can never
 * write to that product (§00.0.1.4).
 */
export const CANONICAL_SUPABASE_PROJECT_REF: string | null = "whwzfdkdxyycsvyvyxdn";

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

/**
 * The single authoritative origin for elevated access, derived from the
 * verified ref — except when the project URL says this is a local stack.
 *
 * That exception is not a convenience. Without it the two clients disagree:
 * `verifySupabaseEnvironmentTarget` accepts a localhost stack for the session
 * client, while this function unconditionally returned the hosted project. So
 * during local development the *elevated* client pointed at production. In CI
 * that surfaced as "Invalid API key", because the local service key is not the
 * hosted one — but the failure is only accidental protection. A developer who
 * happens to have the real service key exported would have had local runs
 * writing to production, silently, with no error to notice.
 *
 * Reachable only when `NEXT_PUBLIC_SUPABASE_URL` is itself localhost, which no
 * deployed environment has. The ref is still verified first, so a BizMetria ref
 * is refused here exactly as before.
 */
export function resolveSupabaseAdminUrl(environment: EnvironmentInput = process.env): string {
  const ref = verifySupabaseProjectRef(environment);

  const projectUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  if (projectUrl) {
    try {
      const parsed = new URL(projectUrl);
      if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
        return projectUrl.replace(/\/$/, "");
      }
    } catch {
      // Not a URL: fall through to the hosted origin, which the session guard
      // will reject on its own terms.
    }
  }

  return `https://${ref}.supabase.co`;
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
