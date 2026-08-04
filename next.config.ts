import type { NextConfig } from "next";

import { validateEnvironment } from "./src/lib/env/schema";

// Build-time environment enforcement (audit §4.2). The public marketing site
// must keep building with no environment at all, so the rule is: if ANY
// platform variable is present, the whole platform scope must validate —
// a half-configured deployment fails the build instead of failing at runtime.
// The "/" locale redirect moved to middleware.ts (cookie + Accept-Language, §9.4).
const platformConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (platformConfigured) {
  const check = validateEnvironment(process.env, "platform");
  if (!check.ok) {
    throw new Error(
      `Platform environment is partially configured. Missing: ${check.missing.join(", ") || "—"}. Invalid: ${check.invalid.join(", ") || "—"}.`,
    );
  }
}

const nextConfig: NextConfig = {};

export default nextConfig;
