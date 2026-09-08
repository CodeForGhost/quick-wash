import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { PipelineLoad } from "@/components/pipeline-rail";
import { Card, EmptyState, Figure, PageTitle, SectionHeading, StatusPill } from "@/components/patterns";
import { today } from "@/lib/format";
import { formatDate, formatPrice } from "@/lib/format";
import { listOrders, statusCounts } from "@/lib/orders";
import { listAgentsWithWorkload } from "@/lib/repos";

export const metadata = { title: "Overview · QuickWash" };

/** FR-023: the administrator's overview of the whole operation. */
export default async function AdminDashboard() {
  await requireRole("ADMIN");

  const todayStr = today();
  const counts = await statusCounts();
  const todayCounts = await statusCounts(todayStr);
  const agents = await listAgentsWithWorkload();

  const unassigned = await listOrders({ statuses: ["PENDING"] });
  const readyForDelivery = await listOrders({ statuses: ["READY"] });
  const todayOrders = await listOrders({ pickupDate: todayStr });

  const active = Object.entries(counts)
    .filter(([status]) => status !== "DELIVERED" && status !== "CANCELLED")
    .reduce((total, [, count]) => total + count, 0);

  const billed = (await listOrders({ statuses: ["DELIVERED"] })).reduce(
    (total, order) => total + (order.price ?? 0),
    0,
  );

  return (
    <>
      <PageTitle
        eyebrow={"Today · " + formatDate(todayStr)}
        title="Operations overview"
        subtitle="Where every order in the system currently sits, and what is waiting on you."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={todayOrders.length} label="Orders today" />
        <Figure value={active} label="Open orders" tone="lagoon" />
        <Figure value={counts.DELIVERED ?? 0} label="Completed" />
        <Figure value={formatPrice(billed)} label="Billed to date" />
      </div>

      <Card className="mb-8 p-5">
        <SectionHeading eyebrow="FR-023" title="Where the work is" />
        <p className="mb-6 -mt-2 text-sm text-ink-soft">
          Every open order counted at the stage it has reached. A tall column means work is piling up there.
        </p>
        <PipelineLoad counts={counts} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* The two queues an administrator personally unblocks (BR-003). */}
        <Card className="p-5">
          <SectionHeading
            eyebrow="Waiting on you"
            title="Needs a pickup agent"
            action={
              unassigned.length > 0 ? (
                <Link href="/admin/orders?status=PENDING" className="text-sm font-semibold text-lagoon">
                  See all
                </Link>
              ) : null
            }
          />
          {unassigned.length === 0 ? (
            <EmptyState title="Every request is assigned" body="New pickup requests will appear here." />
          ) : (
            <ul className="space-y-2">
              {unassigned.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-4 py-3 transition hover:border-ink-faint"
                  >
                    <span className="min-w-0">
                      <span className="tabular block text-xs text-ink-faint">{order.order_number}</span>
                      <span className="block truncate font-medium text-ink">{order.customer_name}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {order.pickup_time_slot} · {order.bag_count}{" "}
                        {order.bag_count === 1 ? "bag" : "bags"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-lagoon">Assign</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading
            eyebrow="Waiting on you"
            title="Ready to go back"
            action={
              readyForDelivery.length > 0 ? (
                <Link href="/admin/orders?status=READY" className="text-sm font-semibold text-lagoon">
                  See all
                </Link>
              ) : null
            }
          />
          {readyForDelivery.length === 0 ? (
            <EmptyState title="Nothing waiting" body="Finished laundry will appear here for delivery assignment." />
          ) : (
            <ul className="space-y-2">
              {readyForDelivery.slice(0, 6).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-4 py-3 transition hover:border-ink-faint"
                  >
                    <span className="min-w-0">
                      <span className="tabular block text-xs text-ink-faint">{order.order_number}</span>
                      <span className="block truncate font-medium text-ink">{order.customer_name}</span>
                      <span className="tabular block text-xs text-ink-soft">{formatPrice(order.price)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-lagoon">Assign</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <SectionHeading
          eyebrow="FR-025"
          title="Agent workload"
          action={
            <Link href="/admin/agents" className="text-sm font-semibold text-lagoon">
              Manage agents
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{agent.name}</p>
                  <p className="tabular text-xs text-ink-faint">{agent.phone}</p>
                </div>
                {agent.is_active ? null : (
                  <span className="rounded-full bg-ground px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-4 border-t border-hairline pt-3">
                <span className="text-xs text-ink-soft">
                  <span className="tabular block text-lg font-bold text-ink">{agent.active_pickups}</span>
                  to collect
                </span>
                <span className="text-xs text-ink-soft">
                  <span className="tabular block text-lg font-bold text-ink">{agent.active_deliveries}</span>
                  to deliver
                </span>
                <span className="text-xs text-ink-soft">
                  <span className="tabular block text-lg font-bold text-ink-faint">{agent.completed}</span>
                  done
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading
          eyebrow="Today"
          title="Today's orders"
          action={
            <Link href="/admin/orders" className="text-sm font-semibold text-lagoon">
              All orders
            </Link>
          }
        />
        {todayOrders.length === 0 ? (
          <EmptyState title="No orders for today" body="Requests booked for today will be listed here." />
        ) : (
          <Card className="divide-y divide-hairline">
            {todayOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center gap-4 p-4 transition hover:bg-ground/40"
              >
                <span className="tabular w-32 shrink-0 text-sm font-semibold text-ink">{order.order_number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{order.customer_name}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {order.pickup_time_slot} · {order.address_area ?? order.address_line}
                  </span>
                </span>
                <StatusPill status={order.status} />
              </Link>
            ))}
          </Card>
        )}
      </section>

      <p className="mt-6 text-xs text-ink-faint">
        Today: {todayCounts.PENDING} new · {todayCounts.PICKUP_ASSIGNED} assigned · {todayCounts.PICKED_UP} collected
      </p>
    </>
  );
}
