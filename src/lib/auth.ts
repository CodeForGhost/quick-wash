import "server-only";
import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, phoneToAuthEmail } from "./supabase/env";
import { signingKeys } from "./supabase/jwks";
import { forbidden, unauthorized } from "./errors";
import { normalisePhone } from "./validation";
import { ROLES, type Role, type SessionUser } from "./types";

/**
 * Sign-in is by mobile number and password, which is what the SRS asks for and
 * what a customer in Puttalam actually has. Supabase Auth is email-based, so
 * each account carries a synthetic address derived from the phone
 * (0771111111@quickwash.local). Nobody sees it and nothing is sent to it; the
 * number remains the only credential anyone types.
 */

/** FR-002. Returns null when the number and password do not match. */
export async function signIn(phone: string, password: string): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(normalisePhone(phone)),
    password,
  });
  if (error || !data.user) return null;
  return getSessionUser();
}

/**
 * FR-001: customer self-signup, on the anon key.
 *
 * The handle_new_user trigger makes the public.users row and always makes it a
 * CUSTOMER - the metadata here cannot ask for anything else. Staff accounts go
 * through createUser() in repos.ts, which needs the service role.
 */
export async function signUpCustomer(input: {
  name: string;
  phone: string;
  email?: string | null;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const phone = normalisePhone(input.phone);

  const { error } = await supabase.auth.signUp({
    email: phoneToAuthEmail(phone),
    password: input.password,
    options: { data: { name: input.name, phone, contact_email: input.email || "" } },
  });

  if (error) {
    const already = /already|registered|exists/i.test(error.message);
    return {
      ok: false,
      error: already
        ? "An account with this mobile number already exists."
        : error.message,
    };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}

/** The claims sync_user_claims keeps in app_metadata. Absent until an account is synced. */
function sessionFromClaims(app: Record<string, unknown> | undefined): SessionUser | null {
  if (!app) return null;

  const id = app.user_id;
  const role = app.user_role;
  if (typeof id !== "number" || typeof role !== "string") return null;
  if (!(ROLES as readonly string[]).includes(role)) return null;
  if (app.is_active === false) return null;

  return {
    id,
    name: typeof app.name === "string" ? app.name : "",
    phone: typeof app.phone === "string" ? app.phone : "",
    email: typeof app.email === "string" ? app.email : null,
    role: role as Role,
    shop_id: typeof app.shop_id === "number" ? app.shop_id : null,
  };
}

/**
 * The signed-in user, or null.
 *
 * getClaims() verifies the token's signature against the project's public key
 * locally, so establishing who is asking costs no network call at all - where
 * getUser() spent one on the Auth API for every request. It is the same
 * guarantee: a forged or expired token fails verification. What it does not
 * do is notice a change made since the token was issued, which is why
 * updateUser() ends the sessions of anyone whose role or shop changed, and why
 * RLS - which always reads the current row - remains the thing that decides.
 *
 * The role, shop and name ride in the token: the sync_user_claims trigger (see
 * schema.sql) keeps them in app_metadata, which Supabase puts in every token.
 * A token issued before an account was synced will not carry them, and this
 * falls back to reading the row, exactly as before.
 *
 * cache() keeps it to once per request: the layout, the page and the guard
 * inside it all ask, and used to each pay for the answer.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getClaims(undefined, {
    jwks: await signingKeys(SUPABASE_URL(), SUPABASE_ANON_KEY()),
  });
  if (error || !data?.claims?.sub) return null;

  const fromToken = sessionFromClaims(data.claims.app_metadata);
  if (fromToken) return fromToken;

  // This token was issued before the account's claims were synced.
  const { data: row } = await supabase
    .from("users")
    .select("id, name, phone, email, role, shop_id, is_active")
    .eq("auth_id", data.claims.sub)
    .maybeSingle();

  if (!row || !row.is_active) return null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role as Role,
    shop_id: row.shop_id,
  };
});

/**
 * Pulls a new access token so a change just written to `users` shows up in the
 * claims immediately, rather than at the next scheduled refresh. Called after
 * someone edits their own profile; a role change ends the session instead.
 */
export async function refreshSessionClaims(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.refreshSession();
}

/** Throws 401 when signed out, 403 when the role is not allowed. */
export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (roles.length && !roles.includes(user.role)) throw forbidden();
  return user;
}

/** Where each role lands after signing in (SRS section 13). */
export const HOME_FOR_ROLE: Record<Role, string> = {
  CUSTOMER: "/customer",
  PICKUP_AGENT: "/agent",
  SHOP_STAFF: "/shop",
  ADMIN: "/admin",
};
