import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, and
 * Server Actions. Uses the Next.js cookie store so the auth session is read and
 * (where allowed) refreshed on the server.
 *
 * Note: writing cookies from a Server Component is not permitted by Next.js, so
 * the setAll handler is wrapped in a try/catch. Session refresh writes happen in
 * the middleware where cookie mutation is allowed.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if middleware refreshes the session.
          }
        },
      },
    },
  );
}
