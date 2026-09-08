import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { transitionOrder } from "@/lib/orders";
import { deliverSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** FR-017: mark the laundry as handed back to the customer. */
export const POST = handle(async (request: Request, { params }: Params) => {
  const user = await requireUser("PICKUP_AGENT", "ADMIN");
  const { id } = await params;
  const input = deliverSchema.parse(await readJson(request));
  const order = await transitionOrder(Number(id), "DELIVERED", user, {
    notes: input.notes || "Delivered to the customer",
  });
  return ok(order);
});
