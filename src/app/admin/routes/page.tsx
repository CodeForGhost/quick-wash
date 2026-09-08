import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { ButtonLink, Card, EmptyState, Figure, PageTitle, SectionHeading } from "@/components/patterns";
import { formatDate, relativeDay } from "@/lib/format";
import { getRouteOrders, listRoutes } from "@/lib/repos";

export const metadata = { title: "Pickup routes · QuickWash" };

/**
 * FR-022: batched pickups. Orders per route is one of the three metrics the MVP
 * exists to measure (SRS section 23), so it leads this screen.
 */
export default async function AdminRoutesPage() {
  await requireRole("ADMIN");
  const routes = await listRoutes();

  const stops = routes.reduce((total, route) => total + route.order_count, 0);
  const perRoute = routes.length ? (stops / routes.length).toFixed(1) : "0";

  // The stops for every route, fetched together rather than inside the render.
  const stopsByRoute = new Map(
    await Promise.all(
      routes.map(async (route) => [route.id, await getRouteOrders(route.id)] as const),
    ),
  );

  return (
    <>
      <PageTitle
        eyebrow="FR-022"
        title="Pickup routes"
        subtitle="Group several pickups into one round for one agent. The more stops per round, the cheaper each pickup gets."
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Figure value={routes.length} label="Routes planned" />
        <Figure value={stops} label="Stops batched" />
        <Figure value={perRoute} label="Stops per route" tone="lagoon" />
      </div>

      <div className="mb-6">
        <ButtonLink href="/admin/routes/new" tone="accent">
          Plan a route
        </ButtonLink>
      </div>

      {routes.length === 0 ? (
        <EmptyState
          title="No routes planned"
          body="Pick a day and an agent, tick the pickups that are close together, and they become one round."
          action={
            <ButtonLink href="/admin/routes/new" tone="accent">
              Plan a route
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-5">
          {routes.map((route) => {
            const orders = stopsByRoute.get(route.id) ?? [];
            const collected = orders.filter((order) => order.order_status !== "PICKUP_ASSIGNED").length;
            const bags = orders.reduce((total, order) => total + order.bag_count, 0);

            return (
              <Card key={route.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline p-5">
                  <div>
                    <p className="eyebrow">{relativeDay(route.route_date)}</p>
                    <h2 className="mt-1 font-display tracking-tighter text-xl font-semibold text-ink">
                      {route.name ?? `Route #${String(route.id).padStart(3, "0")}`}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {route.agent_name} · {orders.length} stops · {bags} bags · {formatDate(route.route_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-display text-2xl font-bold text-ink">
                      {collected}/{orders.length}
                    </p>
                    <p className="text-xs text-ink-soft">collected</p>
                  </div>
                </div>

                <ol className="divide-y divide-hairline">
                  {orders.map((stop) => (
                    <li key={stop.id}>
                      <Link
                        href={`/admin/orders/${stop.order_id}`}
                        className="flex items-center gap-4 px-5 py-3 transition hover:bg-ground/40"
                      >
                        <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-ground text-xs font-bold text-ink">
                          {stop.sequence}
                        </span>
                        <span className="tabular w-32 shrink-0 text-sm font-semibold text-ink">
                          {stop.order_number}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{stop.customer_name}</span>
                        <span className="tabular shrink-0 text-sm text-ink-soft">
                          {stop.bag_count} {stop.bag_count === 1 ? "bag" : "bags"}
                        </span>
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
