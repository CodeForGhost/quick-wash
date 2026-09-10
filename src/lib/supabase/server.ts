import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * A Supabase client bound to the caller's cookies, so every query runs as the
 * signed-in person and row level security applies. Server Components cannot
 * write cookies, which is why the setAll below swallows that error - the token
 * refresh that matters happens in middleware.ts on the way in.
 *
 * cache() makes this one client per request rather than one per call site.
 * Nothing here is expensive to build, but the client is where the session and
 * the verified claims are held: a fresh one per call re-reads and re-verifies
 * the token for every query on the page.
 */
export const supabaseServer = cache(async () => {
  const store = await cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; middleware.ts keeps the session fresh.
        }
      },
    },
  });
});
