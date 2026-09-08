import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteAddress, updateAddress } from "@/lib/repos";
import { addressSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export const PUT = handle(async (request: Request, { params }: Params) => {
  const user = await requireUser("CUSTOMER", "ADMIN");
  const { id } = await params;
  const input = addressSchema.parse(await readJson(request));
  return ok(await updateAddress(Number(id), user.id, input));
});

export const DELETE = handle(async (_request: Request, { params }: Params) => {
  const user = await requireUser("CUSTOMER", "ADMIN");
  const { id } = await params;
  await deleteAddress(Number(id), user.id);
  return ok({ deleted: true });
});
