import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { assertCanView, getOrder } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  const order = getOrder(Number(id));
  if (!order) throw notFound();
  assertCanView(user, order);
  return ok(order);
});
