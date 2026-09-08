import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assignPickupAgent } from "@/lib/orders";
import { createRoute, listRoutes } from "@/lib/repos";
import { routeSchema } from "@/lib/validation";

/** FR-022: batch several pickups into one route for an agent. */
export const GET = handle(async (request: Request) => {
  await requireUser("ADMIN");
  const { searchParams } = new URL(request.url);
  return ok(await listRoutes(undefined, searchParams.get("date") ?? undefined));
});

export const POST = handle(async (request: Request) => {
  const admin = await requireUser("ADMIN");
  const input = routeSchema.parse(await readJson(request));
  const route = await createRoute(
    {
      name: input.name || null,
      agentId: input.agent_id,
      routeDate: input.route_date,
      orderIds: input.order_ids,
    },
    // Each order on the route is assigned through the order service, so it
    // still gets its status history row and notification.
    async (orderId, agentId) => {
      await assignPickupAgent(orderId, agentId, admin);
    },
  );
  return ok(route, 201);
});
