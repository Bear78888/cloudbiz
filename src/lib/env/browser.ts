import { parseBrowserEnvironment } from "./schema";

// NEXT_PUBLIC_* values are inlined at build time, so each one must be listed
// explicitly — reading process.env dynamically would yield undefined.
export function getBrowserEnvironment() {
  return parseBrowserEnvironment({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
}
