import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAddress, listAddresses } from "@/lib/repos";
import { addressSchema } from "@/lib/validation";

/** FR-004: the customer's saved addresses. */
export const GET = handle(async () => {
  const user = await requireUser();
  return ok(await listAddresses(user.id));
});

export const POST = handle(async (request: Request) => {
  const user = await requireUser("CUSTOMER", "ADMIN");
  const input = addressSchema.parse(await readJson(request));
  return ok(await createAddress(user.id, input), 201);
});
