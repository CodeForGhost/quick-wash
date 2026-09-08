import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { Card, EmptyState, PageTitle, StatusPill } from "@/components/patterns";
import { formatDate, relativeDay } from "@/lib/format";
import { getRouteOrders, listRoutes } from "@/lib/repos";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "My routes · QuickWash" };

/** FR-022: the agent's batched rounds, in the order they should be driven. */
export default async function AgentRoutesPage() {
  const user = await requireRole("PICKUP_AGENT");
  const routes = await listRoutes(user.id);

  // The stops for every route, fetched together rather than inside the render.
  const stopsByRoute = new Map(
    await Promise.all(
      routes.map(async (route) => [route.id, await getRouteOrders(route.id)] as const),
    ),
  );

  return (
    <>
      <PageTitle
        eyebrow="Batched pickups"
        title="My routes"
        subtitle="Several stops grouped into one round, in the order they were planned."
      />

      {routes.length === 0 ? (
        <EmptyState
          title="No routes planned"
          body="When an administrator groups several pickups into one round for you, the stops appear here in order."
        />
      ) : (
        <div className="space-y-6">
          {routes.map((route) => {
            const stops = stopsByRoute.get(route.id) ?? [];
            const collected = stops.filter((stop) => stop.order_status !== "PICKUP_ASSIGNED").length;

            return (
              <Card key={route.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline p-5">
                  <div>
                    <p className="eyebrow">{relativeDay(route.route_date)}</p>
                    <h2 className="mt-1 font-display tracking-tighter text-xl font-semibold text-ink">
                      {route.name ?? `Route #${String(route.id).padStart(3, "0")}`}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {stops.length} {stops.length === 1 ? "stop" : "stops"} · {collected} collected ·{" "}
                      {formatDate(route.route_date)}
                    </p>
                  </div>
                  <span className="rounded-full bg-ground px-3 py-1 text-xs font-semibold text-ink-soft">
                    {route.status.replace("_", " ").toLowerCase()}
                  </span>
                </div>

                <ol>
                  {stops.map((stop) => (
                    <li key={stop.id} className="border-b border-hairline last:border-0">
                      <Link
                        href={`/agent/pickups/${stop.order_id}`}
                        className="flex items-center gap-4 p-4 transition hover:bg-ground/40"
                      >
                        <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                          {stop.sequence}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{stop.customer_name}</span>
                          <span className="block truncate text-sm text-ink-soft">
                            {stop.bag_count} {stop.bag_count === 1 ? "bag" : "bags"} · {stop.address_line}
                          </span>
                        </span>
                        <StatusPill status={stop.order_status as OrderStatus} />
                      </Link>
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
