import { createBrowserClient } from "@supabase/ssr";

import { getBrowserEnvironment } from "@/lib/env/browser";

export function createSupabaseBrowserClient() {
  const environment = getBrowserEnvironment();
  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
