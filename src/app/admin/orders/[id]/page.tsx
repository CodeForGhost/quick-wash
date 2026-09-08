import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/components/app-shell";
import { StatusTrail } from "@/components/order-card";
import { PipelineRail } from "@/components/pipeline-rail";
import { Card, DetailRow, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { getOrder, getStatusHistory } from "@/lib/orders";
import { listAgentsWithWorkload } from "@/lib/repos";
import { AssignAgent } from "./assign-agent";

export const metadata = { title: "Order · QuickWash" };

/** The administrator's full view of one order, including agent assignment. */
export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const order = await getOrder(Number(id));
  if (!order) notFound();

  const agents = (await listAgentsWithWorkload()).filter((agent) => agent.is_active);

  // FR-007 / FR-016: pickup assignment before collection, delivery once ready.
  const assignable =
    order.status === "PENDING" || order.status === "PICKUP_ASSIGNED"
      ? "pickup"
      : order.status === "READY" || order.status === "OUT_FOR_DELIVERY"
        ? "delivery"
        : null;

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-block text-sm font-semibold text-lagoon">
        ← All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order</p>
          <h1 className="tabular mt-1 font-display text-3xl font-bold tracking-tighter text-ink">
            {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Created {formatDateTime(order.created_at)}</p>
        </div>
        <StatusPill status={order.status} className="mt-1" />
      </div>

      <Card className="mb-6 p-5">
        <p className="eyebrow mb-5">Progress</p>
        <PipelineRail status={order.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          {assignable ? (
            <AssignAgent
              orderId={order.id}
              type={assignable}
              agents={agents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                phone: agent.phone,
                load: assignable === "pickup" ? agent.active_pickups : agent.active_deliveries,
              }))}
              current={assignable === "pickup" ? order.pickup_agent_id : order.delivery_agent_id}
            />
          ) : null}

          <Card className="p-5">
            <SectionHeading eyebrow="Customer" title={order.customer_name} />
            <dl>
              <DetailRow
                label="Phone"
                value={
                  <a href={`tel:${order.customer_phone}`} className="tabular text-lagoon underline underline-offset-4">
                    {order.customer_phone}
                  </a>
                }
              />
              <DetailRow label="Address" value={order.address_label} />
              <DetailRow
                label="Collect from"
                value={<span className="whitespace-pre-line text-right">{order.address_line}</span>}
              />
              {order.address_area ? <DetailRow label="Area" value={order.address_area} /> : null}
              {order.address_landmark ? <DetailRow label="Landmark" value={order.address_landmark} /> : null}
            </dl>
            <Link
              href={`/admin/customers/${order.customer_id}`}
              className="mt-3 inline-block text-sm font-semibold text-lagoon underline underline-offset-4"
            >
              See this customer&apos;s orders
            </Link>
          </Card>

          <Card className="p-5">
            <SectionHeading eyebrow="The order" title="Details" />
            <dl>
              <DetailRow label="Pickup" value={`${formatDate(order.pickup_date)}, ${order.pickup_time_slot}`} />
              <DetailRow
                label="Bags"
                value={
                  order.actual_bag_count
                    ? `${order.actual_bag_count} collected (${order.bag_count} requested)`
                    : `${order.bag_count} requested`
                }
              />
              {order.item_count ? <DetailRow label="Items (estimate)" value={order.item_count} /> : null}
              <DetailRow label="Price" value={<span className="tabular">{formatPrice(order.price)}</span>} />
              <DetailRow label="Shop" value={order.shop_name ?? "Unassigned"} />
              <DetailRow label="Pickup agent" value={order.pickup_agent_name ?? "Not assigned"} />
              <DetailRow label="Delivery agent" value={order.delivery_agent_name ?? "Not assigned"} />
              {order.notes ? <DetailRow label="Customer note" value={order.notes} /> : null}
            </dl>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <SectionHeading eyebrow="FR-020" title="Status history" />
          <StatusTrail entries={await getStatusHistory(order.id)} />
        </Card>
      </div>
    </>
  );
}
