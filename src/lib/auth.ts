import "server-only";
import { supabaseServer } from "./supabase/server";
import { phoneToAuthEmail } from "./supabase/env";
import { forbidden, unauthorized } from "./errors";
import { normalisePhone } from "./validation";
import type { Role, SessionUser } from "./types";

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

/**
 * The signed-in user, or null.
 *
 * getUser() revalidates the token with Supabase rather than trusting the
 * cookie, so this is safe to gate pages on. The role lives on the users row,
 * not in the JWT, which keeps a stale token from carrying a stale role.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, name, phone, email, role, shop_id, is_active")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    role: data.role as Role,
    shop_id: data.shop_id,
  };
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
