import crypto from "node:crypto";

// NFR 11.2: passwords are hashed, never stored in clear. scrypt from node's
// crypto is used so the app carries no native bcrypt dependency.
//
// This lives apart from `auth.ts` because that module imports `next/headers`,
// which is only available inside a request; scripts such as the seeder need
// hashing without pulling in the request context.

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + derived;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  // Length is checked first: timingSafeEqual throws on a length mismatch.
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}
