import { fail, handle, ok, readJson } from "@/lib/api";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

/** FR-002: sign in with the registered mobile number. */
export const POST = handle(async (request: Request) => {
  const input = loginSchema.parse(await readJson(request));
  const user = await signIn(input.phone, input.password);

  // The same message for an unknown number, a wrong password and a
  // deactivated account, so the response cannot be used to discover which
  // numbers are registered.
  if (!user) return fail("That mobile number and password do not match.", 401);

  return ok({ id: user.id, name: user.name, role: user.role });
});
