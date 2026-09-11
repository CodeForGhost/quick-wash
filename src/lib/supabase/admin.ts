import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client. SERVER ONLY - it bypasses row level security.
 *
 * Used for two things: creating the auth account behind an agent, shop staff
 * or administrator record, which only an administrator can do (FR-025) and
 * which the anon key is not allowed to; and push subscriptions (src/lib/push.ts),
 * which whoever moves an order must be able to read for the customer.
 * Customer self-signup does not go through here.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is needed to create staff " +
        "accounts; find it under Supabase -> Settings -> API.",
    );
  }
  return createClient(SUPABASE_URL(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
