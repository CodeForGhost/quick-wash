import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateUser } from "@/lib/repos";
import { updateUserSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** FR-024 / FR-025: edit or deactivate any account. */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  await requireUser("ADMIN");
  const { id } = await params;
  const input = updateUserSchema.parse(await readJson(request));
  return ok(
    await updateUser(Number(id), {
      name: input.name,
      phone: input.phone,
      email: input.email,
      password: input.password || undefined,
      is_active: input.is_active,
      shop_id: input.shop_id,
    }),
  );
});
