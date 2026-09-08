import { fail, handle, ok, readJson } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { findUserByPhone } from "@/lib/repos";
import { loginSchema } from "@/lib/validation";

/** FR-002: sign in with the registered mobile number. */
export const POST = handle(async (request: Request) => {
  const input = loginSchema.parse(await readJson(request));
  const user = findUserByPhone(input.phone);

  // The same message for an unknown number and a wrong password, so the
  // response cannot be used to discover which numbers are registered.
  if (!user || !verifyPassword(input.password, user.password_hash)) {
    return fail("That mobile number and password do not match.", 401);
  }
  if (!user.is_active) {
    return fail("This account has been deactivated. Please contact the laundry.", 403);
  }

  await createSession(user.id);
  return ok({ id: user.id, name: user.name, role: user.role });
});
