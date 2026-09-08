import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assignDeliveryAgent, assignPickupAgent } from "@/lib/orders";
import { assignAgentSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** FR-007 / FR-016 (BR-003): only an administrator assigns agents. */
export const POST = handle(async (request: Request, { params }: Params) => {
  const admin = await requireUser("ADMIN");
  const { id } = await params;
  const input = assignAgentSchema.parse(await readJson(request));

  const order =
    input.type === "delivery"
      ? assignDeliveryAgent(Number(id), input.agent_id, admin)
      : assignPickupAgent(Number(id), input.agent_id, admin);

  return ok(order);
});
