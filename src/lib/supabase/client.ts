import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in Client Components (runs in the browser).
 * Reads configuration from public environment variables. Empty-string fallbacks
 * keep production builds from throwing when credentials are not yet configured.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  );
}
