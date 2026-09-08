import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listOrders, statusCounts } from "@/lib/orders";
import { statusFilterSchema } from "@/lib/validation";

/** FR-023: every order, filterable by status, date and free text. */
export const GET = handle(async (request: Request) => {
  await requireUser("ADMIN");
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  return ok({
    orders: listOrders({
      statuses: status ? [statusFilterSchema.parse(status)] : undefined,
      pickupDate: searchParams.get("date") ?? undefined,
      search: searchParams.get("q") ?? undefined,
    }),
    counts: statusCounts(),
  });
});
