import { requireRole } from "@/components/app-shell";
import { PipelineLoad } from "@/components/pipeline-rail";
import { Card, DetailRow, Figure, PageTitle, SectionHeading } from "@/components/patterns";
import { formatPrice } from "@/lib/format";
import { listOrders, statusCounts } from "@/lib/orders";
import { listCustomers } from "@/lib/repos";

export const metadata = { title: "Reports · QuickWash" };

/** Hours between two stored timestamps, or null when either is missing. */
function hoursBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = new Date(from.replace(" ", "T") + "Z").getTime();
  const end = new Date(to.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / 3_600_000;
}

function average(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null);
  if (usable.length === 0) return null;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function hours(value: number | null): string {
  if (value === null) return "-";
  if (value < 1) return Math.round(value * 60) + " min";
  return value.toFixed(1) + " h";
}

/**
 * SRS section 23 names three headline numbers: repeat order rate, orders per
 * pickup route, and contribution per order. Batched pickup has been removed,
 * so the second is no longer measurable, and the third needs pickup and
 * delivery costs the system does not record. What is left leads the screen.
 */
export default async function AdminReportsPage() {
  await requireRole("ADMIN");

  const [orders, customers, counts] = await Promise.all([
    listOrders({ limit: 1000 }),
    listCustomers(),
    statusCounts(),
  ]);
  const delivered = orders.filter((order) => order.status === "DELIVERED");
  const cancelled = orders.filter((order) => order.status === "CANCELLED");

  const repeatCustomers = customers.filter((customer) => customer.order_count > 1);
  const repeatRate = customers.length ? (repeatCustomers.length / customers.length) * 100 : 0;

  const revenue = delivered.reduce((total, order) => total + (order.price ?? 0), 0);
  const revenuePerOrder = delivered.length ? revenue / delivered.length : 0;

  const pickupTime = average(orders.map((order) => hoursBetween(order.created_at, order.picked_up_at)));
  const processingTime = average(orders.map((order) => hoursBetween(order.received_at, order.ready_at)));
  const deliveryTime = average(orders.map((order) => hoursBetween(order.ready_at, order.delivered_at)));
  const endToEnd = average(orders.map((order) => hoursBetween(order.created_at, order.delivered_at)));

  const cancellationRate = orders.length ? (cancelled.length / orders.length) * 100 : 0;
  const ordersPerCustomer = customers.length ? orders.length / customers.length : 0;

  return (
    <>
      <PageTitle
        eyebrow="SRS section 23"
        title="Reports"
        subtitle="The numbers that say whether the service works in Puttalam."
      />

      <section className="mb-8">
        <SectionHeading eyebrow="What can be measured" title="Headline metrics" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Figure value={repeatRate.toFixed(0) + "%"} label="Repeat order rate" tone="lagoon" />
          <Figure value={formatPrice(revenuePerOrder)} label="Revenue per order" tone="lagoon" />
        </div>
      </section>

      <Card className="mb-8 p-5">
        <SectionHeading eyebrow="FR-023" title="Orders by stage" />
        <PipelineLoad counts={counts} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <SectionHeading eyebrow="Customers" title="Demand" />
          <dl>
            <DetailRow label="Registered customers" value={customers.length} />
            <DetailRow label="Placed an order" value={customers.filter((c) => c.order_count > 0).length} />
            <DetailRow label="Ordered more than once" value={repeatCustomers.length} />
            <DetailRow label="Orders per customer" value={ordersPerCustomer.toFixed(1)} />
            <DetailRow label="Cancellation rate" value={cancellationRate.toFixed(1) + "%"} />
          </dl>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Operations" title="Speed" />
          <dl>
            <DetailRow label="Request to pickup" value={hours(pickupTime)} />
            <DetailRow label="Processing at shop" value={hours(processingTime)} />
            <DetailRow label="Ready to delivered" value={hours(deliveryTime)} />
            <DetailRow label="End to end" value={hours(endToEnd)} />
          </dl>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Business" title="Money" />
          <dl>
            <DetailRow label="Orders completed" value={delivered.length} />
            <DetailRow label="Total billed" value={<span className="tabular">{formatPrice(revenue)}</span>} />
            <DetailRow
              label="Average order"
              value={<span className="tabular">{formatPrice(revenuePerOrder)}</span>}
            />
            <DetailRow
              label="Items handled"
              value={orders.reduce((total, order) => total + (order.item_count ?? 0), 0)}
            />
            <DetailRow
              label="Bags handled"
              value={orders.reduce((total, order) => total + (order.actual_bag_count ?? order.bag_count), 0)}
            />
          </dl>
        </Card>
      </div>

      <p className="mt-6 max-w-prose text-sm text-ink-soft">
        Pickup and delivery cost per order are not tracked yet, so contribution margin - the third number SRS
        section 23 asks for - cannot be calculated from the system alone. Recording what each collection and
        drop-off costs would close that gap.
      </p>
    </>
  );
}
