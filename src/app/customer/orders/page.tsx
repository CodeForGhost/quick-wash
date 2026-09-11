import { requireRole } from "@/components/app-shell";
import { LiveOrders } from "@/components/live-orders";
import { OrderCard } from "@/components/order-card";
import { ButtonLink, EmptyState, PageTitle, SectionHeading } from "@/components/patterns";
import { formatPrice } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export const metadata = { title: "My orders · QuickWash" };

/** SRS 13.1 screen 9: order history. */
export default async function CustomerOrdersPage() {
  const user = await requireRole("CUSTOMER");
  const orders = await listOrders({ customerId: user.id });

  const active = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED");
  const finished = orders.filter((order) => order.status === "DELIVERED" || order.status === "CANCELLED");
  const spent = finished.reduce((total, order) => total + (order.status === "DELIVERED" ? (order.price ?? 0) : 0), 0);

  return (
    <>
      <LiveOrders customerId={user.id} />
      <PageTitle
        eyebrow="Your history"
        title="My orders"
        subtitle={
          orders.length
            ? `${orders.length} ${orders.length === 1 ? "order" : "orders"} so far · ${formatPrice(spent)} spent`
            : undefined
        }
      />

      {orders.length > 0 ? (
        <div className="mb-6">
          <ButtonLink href="/customer/orders/new" tone="accent">
            Request a pickup
          </ButtonLink>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Your orders will appear here once you book your first pickup."
          action={
            <ButtonLink href="/customer/orders/new" tone="accent">
              Request a pickup
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-8">
          {active.length > 0 ? (
            <section>
              <SectionHeading eyebrow="Open" title="In progress" />
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((order) => (
                  <OrderCard key={order.id} order={order} href={`/customer/orders/${order.id}`} />
                ))}
              </div>
            </section>
          ) : null}

          {finished.length > 0 ? (
            <section>
              <SectionHeading eyebrow="Closed" title="Past orders" />
              <div className="grid gap-3 sm:grid-cols-2">
                {finished.map((order) => (
                  <OrderCard key={order.id} order={order} href={`/customer/orders/${order.id}`} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
