import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { validateEnvironment } from "@/lib/env/schema";

export interface SessionResult {
  response: NextResponse;
  userId: string | null;
  /** false while the owner has not yet provided the Supabase project (§00.0.5). */
  authConfigured: boolean;
}

/**
 * Refreshes the Supabase auth session on every matched request (the standard
 * @supabase/ssr middleware pattern) and reports whether a user is signed in.
 * The caller decides about redirects; this helper only manages cookies.
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  const check = validateEnvironment(
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    "browser",
  );

  let response = NextResponse.next({ request });

  if (!check.ok) {
    return { response, userId: null, authConfigured: false };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() validates the JWT against the auth server — required here so a
  // stale session cannot pass the /app gate. Do not replace with getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, userId: user?.id ?? null, authConfigured: true };
}
