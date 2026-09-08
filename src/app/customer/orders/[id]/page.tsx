import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/components/app-shell";
import { StatusTrail } from "@/components/order-card";
import { PipelineRail } from "@/components/pipeline-rail";
import { Card, DetailRow, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { canTransition, getOrder, getStatusHistory } from "@/lib/orders";
import { CancelOrder } from "./cancel-order";

export const metadata = { title: "Track your order · QuickWash" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

/** SRS 13.1 screens 7-8: the active order and its tracking. */
export default async function OrderTrackingPage({ params, searchParams }: Props) {
  const user = await requireRole("CUSTOMER");
  const { id } = await params;
  const { created } = await searchParams;

  const order = await getOrder(Number(id));
  // BR-008: a customer can only view their own orders.
  if (!order || order.customer_id !== user.id) notFound();

  const history = await getStatusHistory(order.id);
  const canCancel = canTransition(order.status, "CANCELLED");

  return (
    <>
      <Link href="/customer/orders" className="mb-4 inline-block text-sm font-semibold text-lagoon">
        ← All orders
      </Link>

      {created ? (
        <div className="mb-6 rounded-card border border-lagoon/25 bg-lagoon-soft p-4">
          <p className="font-display tracking-tighter text-lg font-semibold text-lagoon-deep">Pickup requested</p>
          <p className="mt-1 text-sm text-lagoon-deep/80">
            We have your request. An agent will be assigned shortly and you will see it here.
          </p>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order</p>
          <h1 className="tabular mt-1 font-display text-3xl font-bold tracking-tighter text-ink">
            {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Requested {formatDateTime(order.created_at)}</p>
        </div>
        <StatusPill status={order.status} className="mt-1" />
      </div>

      <Card className="mb-6 p-5">
        <p className="eyebrow mb-5">Where your laundry is</p>
        <PipelineRail status={order.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading eyebrow="Details" title="This order" />
            <dl>
              <DetailRow label="Pickup" value={`${formatDate(order.pickup_date)}, ${order.pickup_time_slot}`} />
              <DetailRow label="Address" value={order.address_label} />
              <DetailRow
                label="Bags"
                value={order.actual_bag_count ? `${order.actual_bag_count} collected` : `${order.bag_count} requested`}
              />
              {order.item_count ? <DetailRow label="Items (estimated)" value={order.item_count} /> : null}
              <DetailRow
                label="Price"
                value={
                  order.price ? (
                    <span className="tabular">{formatPrice(order.price)}</span>
                  ) : (
                    <span className="text-ink-faint">Set after the shop counts your items</span>
                  )
                }
              />
              {order.pickup_agent_name ? (
                <DetailRow
                  label="Pickup agent"
                  value={
                    order.pickup_agent_phone ? (
                      <a href={`tel:${order.pickup_agent_phone}`} className="text-lagoon underline underline-offset-4">
                        {order.pickup_agent_name}
                      </a>
                    ) : (
                      order.pickup_agent_name
                    )
                  }
                />
              ) : null}
              {order.delivery_agent_name ? (
                <DetailRow label="Delivery agent" value={order.delivery_agent_name} />
              ) : null}
              {order.notes ? <DetailRow label="Your note" value={order.notes} /> : null}
            </dl>

            {canCancel ? <CancelOrder orderId={order.id} /> : null}
          </Card>

          <Card className="p-5">
            <SectionHeading eyebrow="FR-020" title="Everything that happened" />
            <StatusTrail entries={history} />
          </Card>
        </div>

        <Card className="h-fit p-5">
          <SectionHeading eyebrow="Bag tag" title="Order code" />
          <p className="mb-4 text-sm text-ink-soft">
            Attach this to your bag if you can. The shop scans it to find your order.
          </p>
          <div className="rounded-xl border border-hairline bg-white p-4">
            {/* Served by /api/orders/[id]/qr, which checks the session first. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/orders/${order.id}/qr`}
              alt={`QR code for order ${order.order_number}`}
              width={280}
              height={280}
              className="mx-auto block size-full max-w-[220px]"
            />
          </div>
          <p className="tabular mt-3 text-center text-sm font-semibold text-ink">{order.order_number}</p>
        </Card>
      </div>
    </>
  );
}
