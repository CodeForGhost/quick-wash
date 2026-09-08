import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getUser, updateUser } from "@/lib/repos";
import { profileSchema } from "@/lib/validation";

/** FR-003: view and edit the signed-in customer's profile. */
export const GET = handle(async () => {
  const session = await requireUser();
  const user = (await getUser(session.id))!;
  return ok({ id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role });
});

export const PUT = handle(async (request: Request) => {
  const session = await requireUser();
  const input = profileSchema.parse(await readJson(request));
  const user = await updateUser(session.id, { name: input.name, phone: input.phone, email: input.email || null });
  return ok({ id: user.id, name: user.name, phone: user.phone, email: user.email });
});
