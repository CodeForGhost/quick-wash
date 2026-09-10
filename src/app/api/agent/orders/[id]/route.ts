import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { assertCanView, getOrder, getStatusHistory } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

/** FR-009: one pickup, with everything the agent needs at the door. */
export const GET = handle(async (_request: Request, { params }: Params) => {
  const user = await requireUser("PICKUP_AGENT", "ADMIN");
  const { id } = await params;
  const [order, history] = await Promise.all([
    getOrder(Number(id)),
    getStatusHistory(Number(id)),
  ]);
  if (!order) throw notFound();
  assertCanView(user, order);
  return ok({ order, history });
});
