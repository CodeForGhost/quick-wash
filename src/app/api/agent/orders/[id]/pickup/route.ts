import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { transitionOrder } from "@/lib/orders";
import { pickupSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** FR-010: mark the laundry as collected, recording the real bag count. */
export const POST = handle(async (request: Request, { params }: Params) => {
  const user = await requireUser("PICKUP_AGENT", "ADMIN");
  const { id } = await params;
  const input = pickupSchema.parse(await readJson(request));
  const order = await transitionOrder(Number(id), "PICKED_UP", user, {
    actualBagCount: input.actual_bag_count ?? null,
    notes: input.notes || "Laundry collected",
  });
  return ok(order);
});
