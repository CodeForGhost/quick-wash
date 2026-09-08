import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { transitionOrder } from "@/lib/orders";
import { shopStatusSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** FR-012 / FR-013 / FR-015: advance the laundry through processing. */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  const user = await requireUser("SHOP_STAFF", "ADMIN");
  const { id } = await params;
  const input = shopStatusSchema.parse(await readJson(request));
  return ok(transitionOrder(Number(id), input.status, user, { notes: input.notes || null }));
});
