import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

/** FR-008: the agent's own pickups and deliveries. */
export const GET = handle(async (request: Request) => {
  const user = await requireUser("PICKUP_AGENT", "ADMIN");
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "pickup";
  const date = searchParams.get("date") ?? undefined;

  const orders =
    kind === "delivery"
      ? listOrders({
          deliveryAgentId: user.id,
          statuses: ["OUT_FOR_DELIVERY", "DELIVERED"] as OrderStatus[],
        })
      : listOrders({
          pickupAgentId: user.id,
          statuses: ["PICKUP_ASSIGNED", "PICKED_UP"] as OrderStatus[],
          pickupDate: date,
        });

  return ok(orders);
});
