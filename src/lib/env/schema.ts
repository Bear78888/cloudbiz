import { z } from "zod";

// Relative import: this module is loaded by next.config.ts, where the "@"
// path alias is not available.
import { resolveExpectedSupabaseProjectRef } from "../supabase/target";

/**
 * Layered environment validation (spec §33; pattern per audit §4.2):
 * browser ⊂ platform ⊂ integrations. Key prefixes are checked so a value
 * pasted into the wrong variable fails at build time. Error messages carry
 * variable NAMES only — never values.
 *
 * The platform has NOT gone live: Stripe keys are pinned to test mode until
 * the owner explicitly approves live billing by setting STRIPE_LIVE_MODE=live.
 */

export const browserEnvironmentNames = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

export const serverOnlyEnvironmentNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AI_PROVIDER_API_KEY",
  "RESEND_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  "APP_ENCRYPTION_KEY",
  "CRON_SECRET",
] as const;

const rootSupabaseUrl = z
  .url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" })
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return;
    }

    const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const isHostedProject =
      url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/u.test(url.hostname.toLowerCase());
    const isRoot = url.pathname === "/" && url.search === "" && url.hash === "";

    if ((!isLocal && !isHostedProject) || !isRoot) {
      context.addIssue({
        code: "custom",
        message:
          "NEXT_PUBLIC_SUPABASE_URL must be the root project URL without /rest/v1 or another path",
      });
    }
  });

const liveMode = z.literal("live").optional();

function refineStripeMode(
  value: {
    STRIPE_LIVE_MODE?: "live" | undefined;
    STRIPE_SECRET_KEY?: string | undefined;
    STRIPE_WEBHOOK_SECRET?: string | undefined;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  const live = value.STRIPE_LIVE_MODE === "live";
  const checks: Array<[key: string, val: string | undefined, test: string, liveP: string]> = [
    ["STRIPE_SECRET_KEY", value.STRIPE_SECRET_KEY, "sk_test_", "sk_live_"],
    [
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      "pk_test_",
      "pk_live_",
    ],
  ];
  for (const [key, val, testPrefix, livePrefix] of checks) {
    if (val === undefined) continue;
    const expected = live ? livePrefix : testPrefix;
    if (!val.startsWith(expected)) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: `${key} must start with ${expected} (STRIPE_LIVE_MODE=${live ? "live" : "unset → test mode"})`,
      });
    }
  }
  if (value.STRIPE_WEBHOOK_SECRET !== undefined && !value.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
    context.addIssue({
      code: "custom",
      path: ["STRIPE_WEBHOOK_SECRET"],
      message: "STRIPE_WEBHOOK_SECRET must be a webhook signing secret (whsec_...)",
    });
  }
}

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url({ error: "NEXT_PUBLIC_APP_URL must be a valid URL" }).optional(),
  NEXT_PUBLIC_SUPABASE_URL: rootSupabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const browserEnvironmentObject = publicSchema.extend({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_LIVE_MODE: liveMode,
});

export const browserEnvironmentSchema = browserEnvironmentObject.superRefine(refineStripeMode);

const platformEnvironmentObject = publicSchema.extend({
  // Server-owned project ref — the target guard (src/lib/supabase/target.ts)
  // verifies elevated access against this, never against the public URL.
  SUPABASE_PROJECT_REF: z.string().min(1, "SUPABASE_PROJECT_REF is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_TARGET_ENV: z.literal("preview").optional(),
});

const integrationEnvironmentObject = platformEnvironmentObject.extend({
  STRIPE_LIVE_MODE: liveMode,
  // Prefix enforcement happens in refineStripeMode: the allowed prefix
  // (sk_test_/sk_live_) depends on STRIPE_LIVE_MODE on the same object.
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  // Optional until the webhook endpoint is registered in Stripe; the webhook
  // route fails closed without it.
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required"),

  // Later stages (§14 Google, §16 AI, §17 messaging) — optional so Stage 1
  // deployments build before those credentials exist; each feature fails
  // closed on its own when its variable is missing.
  AI_PROVIDER_API_KEY: z.string().min(1).optional(),
  AI_PROVIDER_MODEL: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.email({ error: "RESEND_FROM_EMAIL must be a valid address" }).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),
  // Browser-side key for the Google Picker (§14.4). It is public by nature —
  // restricted by HTTP referrer, not by secrecy — but it has no NEXT_PUBLIC_
  // prefix, so it does not reach the browser through `process.env`. The Picker
  // component receives it as a prop from a server component instead. Named
  // here so a missing value is a validation error rather than an undefined at
  // the moment the user clicks "connect an existing sheet".
  GOOGLE_PICKER_API_KEY: z.string().min(1).optional(),
  // Not a routinely rotatable secret: it encrypts stored Google refresh
  // tokens, so changing it makes every existing connection unreadable and
  // forces every customer to reconnect by hand. See the launch checklist,
  // where it is an explicit exception to the key rotation at the domain move.
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  APP_ENCRYPTION_KEY: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

// The server-owned ref must match the canonical platform project (or a
// registered preview target) — a deployment pointed at any other project,
// including BizMetria, fails the build (audit §4.2).
function refineSupabaseProjectRef(
  value: { SUPABASE_PROJECT_REF: string; SUPABASE_TARGET_ENV?: "preview" | undefined },
  context: z.RefinementCtx,
): void {
  const expectedRef = resolveExpectedSupabaseProjectRef(value);
  if (value.SUPABASE_PROJECT_REF !== expectedRef) {
    context.addIssue({
      code: "custom",
      path: ["SUPABASE_PROJECT_REF"],
      message: `SUPABASE_PROJECT_REF must be ${expectedRef}`,
    });
  }
}

export const platformEnvironmentSchema = platformEnvironmentObject.superRefine(refineSupabaseProjectRef);
export const integrationEnvironmentSchema = integrationEnvironmentObject
  .superRefine(refineStripeMode)
  .superRefine(refineSupabaseProjectRef);

export type BrowserEnvironment = z.infer<typeof browserEnvironmentSchema>;
export type PlatformEnvironment = z.infer<typeof platformEnvironmentSchema>;
export type IntegrationEnvironment = z.infer<typeof integrationEnvironmentSchema>;

export type EnvironmentScope = "browser" | "platform" | "integrations";

export interface EnvironmentCheck {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly invalid: readonly string[];
}

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

function schemaForScope(scope: EnvironmentScope) {
  if (scope === "browser") return browserEnvironmentSchema;
  if (scope === "integrations") return integrationEnvironmentSchema;
  return platformEnvironmentSchema;
}

function issueVariableName(path: PropertyKey[]): string {
  const first = path[0];
  return typeof first === "string" ? first : "UNKNOWN_ENVIRONMENT_VARIABLE";
}

export function validateEnvironment(
  input: EnvironmentInput,
  scope: EnvironmentScope = "platform",
): EnvironmentCheck {
  const result = schemaForScope(scope).safeParse(input);
  if (result.success) {
    return { ok: true, missing: [], invalid: [] };
  }

  const missing = new Set<string>();
  const invalid = new Set<string>();
  for (const issue of result.error.issues) {
    const name = issueVariableName(issue.path);
    const value = input[name];
    if (value === undefined || value === "") {
      missing.add(name);
    } else {
      invalid.add(name);
    }
  }
  return { ok: false, missing: [...missing].sort(), invalid: [...invalid].sort() };
}

export class EnvironmentValidationError extends Error {
  readonly missing: readonly string[];
  readonly invalid: readonly string[];

  constructor(check: EnvironmentCheck) {
    const names = [...check.missing, ...check.invalid].sort();
    super(`Environment validation failed: ${names.join(", ")}`);
    this.name = "EnvironmentValidationError";
    this.missing = check.missing;
    this.invalid = check.invalid;
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: EnvironmentInput, scope: EnvironmentScope): T {
  const check = validateEnvironment(input, scope);
  if (!check.ok) throw new EnvironmentValidationError(check);
  return schema.parse(input);
}

export function parseBrowserEnvironment(input: EnvironmentInput): BrowserEnvironment {
  return parseOrThrow(browserEnvironmentSchema, input, "browser");
}

export function parsePlatformEnvironment(input: EnvironmentInput): PlatformEnvironment {
  return parseOrThrow(platformEnvironmentSchema, input, "platform");
}

export function parseIntegrationEnvironment(input: EnvironmentInput): IntegrationEnvironment {
  return parseOrThrow(integrationEnvironmentSchema, input, "integrations");
}
