import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { Card, EmptyState, PageTitle, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, formatPrice } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export const metadata = { title: "Deliveries · QuickWash" };

/** SRS 13.2 screen 6: clean laundry waiting to go back to customers. */
export default async function AgentDeliveriesPage() {
  const user = await requireRole("PICKUP_AGENT");
  const orders = listOrders({
    deliveryAgentId: user.id,
    statuses: ["OUT_FOR_DELIVERY", "DELIVERED"],
  });

  const out = orders.filter((order) => order.status === "OUT_FOR_DELIVERY");
  const done = orders.filter((order) => order.status === "DELIVERED");

  return (
    <>
      <PageTitle
        eyebrow={"Agent · " + user.name}
        title="Deliveries"
        subtitle="Clean laundry assigned to you. Collect it from the shop and take it back."
      />

      <section className="mb-8">
        <SectionHeading eyebrow="Out with you" title="To deliver" />
        {out.length === 0 ? (
          <EmptyState
            title="Nothing to deliver"
            body="When the shop finishes an order and an administrator assigns it to you, it shows up here."
          />
        ) : (
          <ol className="space-y-3">
            {out.map((order) => (
              <li key={order.id}>
                <Card className="overflow-hidden">
                  <Link
                    href={`/agent/deliveries/${order.id}`}
                    className="block p-4 transition hover:bg-ground/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="tabular text-xs font-semibold text-ink-faint">{order.order_number}</p>
                        <p className="mt-1 font-display tracking-tighter text-lg font-semibold text-ink">{order.customer_name}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{order.address_line}</p>
                        {order.address_landmark ? (
                          <p className="mt-1 text-xs text-ink-faint">Landmark: {order.address_landmark}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusPill status={order.status} />
                        <p className="tabular mt-2 text-sm font-semibold text-ink">{formatPrice(order.price)}</p>
                        <p className="text-xs text-ink-faint">to collect</p>
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
                      href={`/agent/deliveries/${order.id}`}
                      className="flex-1 py-3 text-center text-sm font-semibold text-ink transition hover:bg-ground"
                    >
                      Open drop-off
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      {done.length > 0 ? (
        <section>
          <SectionHeading eyebrow="Finished" title="Delivered" />
          <ul className="space-y-2">
            {done.slice(0, 10).map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{order.customer_name}</p>
                  <p className="tabular text-xs text-ink-faint">
                    {order.order_number} · {formatDate(order.delivered_at)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatPrice(order.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
