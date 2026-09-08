import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cancelOrder } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (request: Request, { params }: Params) => {
  const user = await requireUser("CUSTOMER", "ADMIN");
  const { id } = await params;
  const body = (await readJson(request)) as { reason?: string };
  return ok(await cancelOrder(Number(id), user, body?.reason));
});
