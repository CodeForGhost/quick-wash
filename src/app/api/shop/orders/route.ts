import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

const GROUPS: Record<string, OrderStatus[]> = {
  incoming: ["PICKED_UP"],
  processing: ["AT_LAUNDRY", "WASHING", "DRYING", "IRONING"],
  ready: ["READY", "OUT_FOR_DELIVERY"],
  completed: ["DELIVERED"],
};

/** FR-012: the shop's work queues. */
export const GET = handle(async (request: Request) => {
  const user = await requireUser("SHOP_STAFF", "ADMIN");
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group");
  const statuses = group ? GROUPS[group] : undefined;

  return ok(
    await listOrders({
      shopId: user.shop_id ?? undefined,
      statuses,
      search: searchParams.get("q") ?? undefined,
    }),
  );
});
