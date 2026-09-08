import { handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createUser, listAgentsWithWorkload } from "@/lib/repos";
import { createAgentSchema } from "@/lib/validation";

/** FR-025: agent management, including current workload. */
export const GET = handle(async () => {
  await requireUser("ADMIN");
  return ok(listAgentsWithWorkload());
});

export const POST = handle(async (request: Request) => {
  await requireUser("ADMIN");
  const input = createAgentSchema.parse(await readJson(request));
  const user = createUser({
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    password: input.password,
    role: input.role,
    shopId: input.shop_id ?? null,
  });
  return ok(user, 201);
});
