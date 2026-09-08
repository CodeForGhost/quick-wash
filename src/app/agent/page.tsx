import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { Card, EmptyState, Figure, PageTitle, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, relativeDay } from "@/lib/format";
import { listOrders } from "@/lib/orders";
import { today } from "@/lib/format";

export const metadata = { title: "Today's pickups · QuickWash" };

/** FR-008: the agent's pickup dashboard, grouped by day. */
export default async function AgentDashboard() {
  const user = await requireRole("PICKUP_AGENT");
  const orders = await listOrders({
    pickupAgentId: user.id,
    statuses: ["PICKUP_ASSIGNED", "PICKED_UP"],
  });

  const todayStr = today();
  const todays = orders.filter((order) => order.pickup_date === todayStr);
  const upcoming = orders.filter((order) => order.pickup_date > todayStr);
  const overdue = orders.filter((order) => order.pickup_date < todayStr);

  const waiting = todays.filter((order) => order.status === "PICKUP_ASSIGNED");
  const bags = waiting.reduce((total, order) => total + order.bag_count, 0);

  return (
    <>
      <PageTitle
        eyebrow={"Agent · " + user.name}
        title="Today's pickups"
        subtitle="Work down the list. Tap a stop to see the address and mark it collected."
      />

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Figure value={waiting.length} label="Still to collect" tone="sun" />
        <Figure value={bags} label="Bags waiting" />
        <Figure value={todays.length - waiting.length} label="Collected today" tone="lagoon" />
      </div>

      {overdue.length > 0 ? (
        <section className="mb-8">
          <SectionHeading eyebrow="Missed" title="From earlier days" />
          <StopList orders={overdue} />
        </section>
      ) : null}

      <section className="mb-8">
        <SectionHeading eyebrow={relativeDay(todayStr)} title="Your round today" />
        {todays.length === 0 ? (
          <EmptyState
            title="No pickups today"
            body="When an administrator assigns you a pickup, it appears here with the customer's address and phone number."
          />
        ) : (
          <StopList orders={todays} />
        )}
      </section>

      {upcoming.length > 0 ? (
        <section>
          <SectionHeading eyebrow="Ahead" title="Coming up" />
          <StopList orders={upcoming} showDate />
        </section>
      ) : null}
    </>
  );
}

/** One stop on the round. Built for a thumb: big tap area, phone number first. */
function StopList({
  orders,
  showDate = false,
}: {
  orders: Awaited<ReturnType<typeof listOrders>>;
  showDate?: boolean;
}) {
  return (
    <ol className="space-y-3">
      {orders.map((order) => (
        <li key={order.id}>
          <Card className="overflow-hidden">
            <Link href={`/agent/pickups/${order.id}`} className="block p-4 transition hover:bg-ground/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tabular text-xs font-semibold text-ink-faint">
                    {order.pickup_time_slot}
                    {showDate ? " · " + formatDate(order.pickup_date) : ""}
                  </p>
                  <p className="mt-1 font-display tracking-tighter text-lg font-semibold text-ink">{order.customer_name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {order.bag_count} {order.bag_count === 1 ? "bag" : "bags"}
                    {order.address_area ? " · " + order.address_area : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{order.address_line}</p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusPill status={order.status} />
                  <p className="tabular mt-2 text-xs text-ink-faint">{order.order_number}</p>
                </div>
              </div>
            </Link>
            <div className="flex border-t border-hairline">
              <a
                href={`tel:${order.address_phone ?? order.customer_phone}`}
                className="flex-1 border-r border-hairline py-3 text-center text-sm font-semibold text-lagoon transition hover:bg-lagoon-soft/50"
              >
                Call customer
              </a>
              <Link
                href={`/agent/pickups/${order.id}`}
                className="flex-1 py-3 text-center text-sm font-semibold text-ink transition hover:bg-ground"
              >
                Open stop
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}
