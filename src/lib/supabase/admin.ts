import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPlatformEnvironment } from "@/lib/env/server";
import { resolveSupabaseAdminUrl } from "@/lib/supabase/target";

/**
 * Service-role client. RLS does NOT apply — use only in trusted server code
 * (webhooks, background workers, admin actions) and never expose results
 * without an explicit organization check. The origin comes from the verified
 * server-owned project ref, not from the public URL (see target.ts).
 */
export function createSupabaseAdminClient() {
  const projectUrl = resolveSupabaseAdminUrl();
  const environment = getPlatformEnvironment();

  // A Vercel Marketplace Supabase integration owns the `SUPABASE_*` names and
  // can overwrite them with another project's credentials. Prefer a
  // namespaced variable no third party manages; fall back to the standard.
  const secretKey =
    process.env.HANDYALLIANCE_SUPABASE_SERVICE_ROLE_KEY ||
    environment.SUPABASE_SERVICE_ROLE_KEY;

  return createClient(projectUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
