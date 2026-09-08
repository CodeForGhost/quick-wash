import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { setPrice } from "@/lib/orders";
import { priceSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** FR-014 / BR-010: set the final price for an order. */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  const user = await requireUser("SHOP_STAFF", "ADMIN");
  const { id } = await params;
  const input = priceSchema.parse(await readJson(request));
  return ok(setPrice(Number(id), input.price, user));
});
