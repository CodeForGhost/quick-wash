import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { assertCanView, getOrder, getOrderByNumber, getStatusHistory } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

/**
 * Accepts either the numeric id or the order number, so a scanned QR code can be
 * looked up directly.
 */
export const GET = handle(async (_request: Request, { params }: Params) => {
  const user = await requireUser("SHOP_STAFF", "ADMIN");
  const { id } = await params;
  const order = /^\d+$/.test(id) ? await getOrder(Number(id)) : await getOrderByNumber(id.toUpperCase());
  if (!order) throw notFound();
  assertCanView(user, order);
  return ok({ order, history: await getStatusHistory(order.id) });
});
