import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createOrder, listOrders } from "@/lib/orders";
import { createOrderSchema } from "@/lib/validation";

/** BR-008: a customer only ever sees their own orders. */
export const GET = handle(async () => {
  const user = await requireUser();
  const orders = user.role === "CUSTOMER" ? await listOrders({ customerId: user.id }) : await listOrders();
  return ok(orders);
});

/** FR-005 / FR-006: create a pickup request. */
export const POST = handle(async (request: Request) => {
  const user = await requireUser("CUSTOMER", "ADMIN");
  const input = createOrderSchema.parse(await readJson(request));
  const order = await createOrder(
    {
      customerId: user.id,
      addressId: input.address_id,
      pickupDate: input.pickup_date,
      pickupTimeSlot: input.pickup_time_slot,
      bagCount: input.bag_count,
      itemCount: input.item_count ?? null,
      notes: input.notes || null,
    },
    user.id,
  );
  return ok(order, 201);
});
