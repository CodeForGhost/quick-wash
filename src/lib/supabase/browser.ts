import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * A Supabase client for the browser, reading the same auth cookie the server
 * clients do, so anything it opens - today, only the Realtime socket behind
 * the customer's order pages - runs as the signed-in person and row level
 * security applies to what it is sent.
 *
 * The two env names are spelled out rather than read through env.ts: Next
 * only inlines NEXT_PUBLIC_ values into the client bundle when it can see the
 * literal `process.env.NAME`, and env.ts reads them by string at runtime.
 *
 * One instance per tab: every subscriber shares a single socket, and
 * supabase-js pushes each refreshed token down it on our behalf.
 */
export function supabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example).",
    );
  }

  client = createBrowserClient(url, key);
  return client;
}
