/**
 * Copies each person's row id, role, shop and name into their auth account's
 * app_metadata, which Supabase places in every access token it issues.
 *
 *   npx tsx --env-file=.env.local scripts/sync-claims.ts
 *
 * getSessionUser() reads those claims instead of querying `users` - one round
 * trip fewer on every request. From now on the sync_user_claims trigger in
 * schema.sql keeps them current; this script is the one-time backfill for
 * accounts that already exist, and a repair tool if they ever drift.
 *
 * Additive: app_metadata is merged, so the provider keys Supabase keeps there
 * survive. An open session picks the claims up at its next token refresh
 * (within the hour) or sign-in.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: users, error } = await admin
    .from("users")
    .select("id, auth_id, name, phone, email, role, shop_id, is_active")
    .not("auth_id", "is", null);
  if (error) throw error;

  let synced = 0;
  for (const u of users ?? []) {
    const { error: fail } = await admin.auth.admin.updateUserById(u.auth_id as string, {
      app_metadata: {
        user_id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        user_role: u.role,
        shop_id: u.shop_id,
        is_active: u.is_active,
      },
    });
    if (fail) {
      console.error(`  ${u.phone} (${u.role}): ${fail.message}`);
      continue;
    }
    synced += 1;
  }
  console.log(`synced ${synced} of ${users?.length ?? 0} accounts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
