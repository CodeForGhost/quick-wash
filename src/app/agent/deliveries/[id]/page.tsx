import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/components/app-shell";
import { StatusTrail } from "@/components/order-card";
import { Card, DetailRow, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getOrder, getStatusHistory } from "@/lib/orders";
import { MarkDelivered } from "./mark-delivered";

export const metadata = { title: "Delivery · QuickWash" };

/** SRS 13.2 screen 7 / FR-017. */
export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("PICKUP_AGENT");
  const { id } = await params;

  const order = getOrder(Number(id));
  // BR-004: only the assigned delivery agent may open this.
  if (!order || order.delivery_agent_id !== user.id) notFound();

  const phone = order.address_phone ?? order.customer_phone;

  return (
    <>
      <Link href="/agent/deliveries" className="mb-4 inline-block text-sm font-semibold text-lagoon">
        ← Deliveries
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="tabular eyebrow">{order.order_number}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tighter text-ink">{order.customer_name}</h1>
          <p className="mt-1 text-sm text-ink-soft">Ready since {formatDateTime(order.ready_at)}</p>
        </div>
        <StatusPill status={order.status} className="mt-1" />
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="p-5">
          <p className="eyebrow mb-2">Deliver to</p>
          <p className="whitespace-pre-line text-lg font-medium leading-snug text-ink">{order.address_line}</p>
          {order.address_area ? <p className="mt-1 text-ink-soft">{order.address_area}</p> : null}
          {order.address_landmark ? (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="font-semibold text-ink">Landmark:</span> {order.address_landmark}
            </p>
          ) : null}
        </div>
        <div className="flex border-t border-hairline">
          <a
            href={`tel:${phone}`}
            className="flex-1 border-r border-hairline py-4 text-center font-semibold text-lagoon transition hover:bg-lagoon-soft/50"
          >
            Call {order.customer_name.split(" ")[0]}
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [order.address_line, order.address_area, "Puttalam, Sri Lanka"].filter(Boolean).join(", "),
            )}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-4 text-center font-semibold text-ink transition hover:bg-ground"
          >
            Open in Maps
          </a>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading eyebrow="Hand over" title="What to collect" />
          <dl>
            <DetailRow label="Bags" value={order.actual_bag_count ?? order.bag_count} />
            <DetailRow
              label="Amount to collect"
              value={<span className="tabular font-semibold">{formatPrice(order.price)}</span>}
            />
            <DetailRow label="Customer phone" value={<span className="tabular">{phone}</span>} />
          </dl>

          {order.status === "OUT_FOR_DELIVERY" ? (
            <MarkDelivered orderId={order.id} />
          ) : (
            <p className="mt-5 rounded-xl bg-lagoon-soft px-4 py-3 text-sm font-medium text-lagoon-deep">
              Delivered {formatDateTime(order.delivered_at)}. This order is complete.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Trail" title="What has happened" />
          <StatusTrail entries={getStatusHistory(order.id)} />
        </Card>
      </div>
    </>
  );
}
