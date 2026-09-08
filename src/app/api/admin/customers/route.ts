import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listCustomers } from "@/lib/repos";

/** FR-024: customer management. */
export const GET = handle(async (request: Request) => {
  await requireUser("ADMIN");
  const { searchParams } = new URL(request.url);
  return ok(await listCustomers(searchParams.get("q") ?? undefined));
});
