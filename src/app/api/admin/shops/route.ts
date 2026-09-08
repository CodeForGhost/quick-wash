import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createShop, listShops } from "@/lib/repos";
import { shopSchema } from "@/lib/validation";

/** FR-026: laundry shop management. */
export const GET = handle(async () => {
  await requireUser("ADMIN");
  return ok(await listShops());
});

export const POST = handle(async (request: Request) => {
  await requireUser("ADMIN");
  const input = shopSchema.parse(await readJson(request));
  return ok(await createShop(input), 201);
});
