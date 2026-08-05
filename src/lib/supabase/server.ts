import "server-only";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";
import { cookies } from "next/headers";

import { getPlatformEnvironment } from "@/lib/env/server";
import { verifySupabaseEnvironmentTarget } from "@/lib/supabase/target";

/** Anon-key client bound to the request's auth cookies. RLS applies. */
export async function createSupabaseServerClient() {
  verifySupabaseEnvironmentTarget();
  const environment = getPlatformEnvironment();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. Route handlers and Server Actions can.
          }
        },
      },
    },
  );
}
