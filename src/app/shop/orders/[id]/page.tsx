import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/components/app-shell";
import { StatusTrail } from "@/components/order-card";
import { PipelineRail } from "@/components/pipeline-rail";
import { Card, DetailRow, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, formatDateTime } from "@/lib/format";
import { assertCanView, getOrder, getStatusHistory } from "@/lib/orders";
import { ProcessingControls } from "./processing-controls";

export const metadata = { title: "Order · QuickWash" };

/** SRS 13.3 screen 4: the shop's view of one order. */
export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("SHOP_STAFF");
  const { id } = await params;

  const order = getOrder(Number(id));
  if (!order) notFound();
  assertCanView(user, order);

  return (
    <>
      <Link href="/shop" className="mb-4 inline-block text-sm font-semibold text-lagoon">
        ← The counter
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order</p>
          <h1 className="tabular mt-1 font-display text-3xl font-bold tracking-tighter text-ink">
            {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {order.customer_name} · <span className="tabular">{order.customer_phone}</span>
          </p>
        </div>
        <StatusPill status={order.status} className="mt-1" />
      </div>

      <Card className="mb-6 p-5">
        <p className="eyebrow mb-5">Where this order is</p>
        <PipelineRail status={order.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading eyebrow="The bag" title="What arrived" />
            <dl>
              <DetailRow
                label="Bags"
                value={
                  order.actual_bag_count && order.actual_bag_count !== order.bag_count
                    ? `${order.actual_bag_count} collected (customer said ${order.bag_count})`
                    : (order.actual_bag_count ?? order.bag_count)
                }
              />
              {order.item_count ? <DetailRow label="Items (customer estimate)" value={order.item_count} /> : null}
              <DetailRow label="Requested pickup" value={formatDate(order.pickup_date)} />
              {order.picked_up_at ? (
                <DetailRow label="Collected" value={formatDateTime(order.picked_up_at)} />
              ) : null}
              {order.pickup_agent_name ? <DetailRow label="Brought in by" value={order.pickup_agent_name} /> : null}
              {order.notes ? <DetailRow label="Customer note" value={order.notes} /> : null}
            </dl>
          </Card>

          <Card className="p-5">
            <SectionHeading eyebrow="Bag tag" title="Order code" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/orders/${order.id}/qr`}
              alt={`QR code for order ${order.order_number}`}
              width={200}
              height={200}
              className="mx-auto block w-full max-w-[180px] rounded-lg border border-hairline bg-white p-3"
            />
          </Card>
        </div>

        <div className="space-y-6">
          <ProcessingControls
            orderId={order.id}
            status={order.status}
            price={order.price}
            itemCount={order.item_count}
          />

          <Card className="p-5">
            <SectionHeading eyebrow="FR-020" title="Status history" />
            <StatusTrail entries={getStatusHistory(order.id)} />
          </Card>
        </div>
      </div>
    </>
  );
}
