import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteRoute, getRoute, getRouteOrders, updateRouteStatus } from "@/lib/repos";
import { notFound } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (_request: Request, { params }: Params) => {
  await requireUser("ADMIN", "PICKUP_AGENT");
  const { id } = await params;
  const route = getRoute(Number(id));
  if (!route) throw notFound();
  return ok({ route, orders: getRouteOrders(route.id) });
});

export const PATCH = handle(async (request: Request, { params }: Params) => {
  await requireUser("ADMIN", "PICKUP_AGENT");
  const { id } = await params;
  const body = (await readJson(request)) as { status?: string };
  const status = body?.status;
  if (status !== "PLANNED" && status !== "IN_PROGRESS" && status !== "COMPLETED" && status !== "CANCELLED") {
    throw notFound();
  }
  return ok(updateRouteStatus(Number(id), status));
});

export const DELETE = handle(async (_request: Request, { params }: Params) => {
  await requireUser("ADMIN");
  const { id } = await params;
  deleteRoute(Number(id));
  return ok({ deleted: true });
});
