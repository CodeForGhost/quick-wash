import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, get, run } from "./db";
import { forbidden, unauthorized } from "./errors";
import type { Role, SessionUser, User } from "./types";

export { hashPassword, verifyPassword } from "./password";

const SESSION_COOKIE = "laundry_session";
const SESSION_DAYS = 30;

export async function createSession(userId: number): Promise<void> {
  const id = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", id, userId, expires.toISOString());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) run("DELETE FROM sessions WHERE id = ?", id);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call from pages and route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const row = get<User & { expires_at: string }>(
    `SELECT u.*, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    id,
  );
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE id = ?", id);
    return null;
  }
  if (!row.is_active) return null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    shop_id: row.shop_id,
  };
}

/** Throws 401 when signed out, 403 when the role is not allowed. */
export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (roles.length && !roles.includes(user.role)) throw forbidden();
  return user;
}

export function purgeExpiredSessions(): void {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
}

/** Where each role lands after signing in (SRS section 13). */
export const HOME_FOR_ROLE: Record<Role, string> = {
  CUSTOMER: "/customer",
  PICKUP_AGENT: "/agent",
  SHOP_STAFF: "/shop",
  ADMIN: "/admin",
};
