import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * A Supabase client bound to the caller's cookies, so every query runs as the
 * signed-in person and row level security applies. Server Components cannot
 * write cookies, which is why the setAll below swallows that error - the token
 * refresh that matters happens in proxy.ts on the way in.
 */
export async function supabaseServer() {
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
          // Called from a Server Component; proxy.ts keeps the session fresh.
        }
      },
    },
  });
}
