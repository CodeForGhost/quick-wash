import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/components/app-shell";
import { Card, DetailRow, EmptyState, Figure, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { listOrders } from "@/lib/orders";
import { getUser, listAddresses } from "@/lib/repos";

export const metadata = { title: "Customer · QuickWash" };

/** FR-024: one customer, their addresses and every order they have placed. */
export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const customer = await getUser(Number(id));
  if (!customer || customer.role !== "CUSTOMER") notFound();

  const orders = await listOrders({ customerId: customer.id });
  const addresses = await listAddresses(customer.id);
  const delivered = orders.filter((order) => order.status === "DELIVERED");
  const spend = delivered.reduce((total, order) => total + (order.price ?? 0), 0);

  return (
    <>
      <Link href="/admin/customers" className="mb-4 inline-block text-sm font-semibold text-lagoon">
        ← Customers
      </Link>

      <div className="mb-6">
        <p className="eyebrow">Customer</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tighter text-ink">{customer.name}</h1>
        <p className="tabular mt-1 text-sm text-ink-soft">
          {customer.phone}
          {customer.email ? " · " + customer.email : ""}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Figure value={orders.length} label="Orders placed" />
        <Figure value={delivered.length} label="Completed" tone="lagoon" />
        <Figure value={formatPrice(spend)} label="Billed" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit p-5">
          <SectionHeading eyebrow="FR-004" title="Saved addresses" />
          {addresses.length === 0 ? (
            <p className="text-sm text-ink-faint">No addresses saved.</p>
          ) : (
            <ul className="space-y-4">
              {addresses.map((address) => (
                <li key={address.id} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
                  <p className="font-semibold text-ink">{address.label}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{address.address}</p>
                  {address.landmark ? (
                    <p className="mt-1 text-xs text-ink-faint">Landmark: {address.landmark}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 border-t border-hairline pt-4">
            <dl>
              <DetailRow label="Registered" value={formatDateTime(customer.created_at)} />
              <DetailRow label="Account" value={customer.is_active ? "Active" : "Disabled"} />
            </dl>
          </div>
        </Card>

        <div>
          <SectionHeading eyebrow="FR-019" title="Order history" />
          {orders.length === 0 ? (
            <EmptyState title="No orders yet" body="This customer has registered but not booked a pickup." />
          ) : (
            <Card className="divide-y divide-hairline overflow-hidden">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition hover:bg-ground/40"
                >
                  <span className="tabular w-32 shrink-0 text-sm font-semibold text-ink">
                    {order.order_number}
                  </span>
                  <span className="min-w-24 flex-1 text-sm text-ink-soft">{formatDate(order.pickup_date)}</span>
                  <span className="tabular w-24 shrink-0 text-right text-sm font-semibold text-ink">
                    {order.price ? formatPrice(order.price) : "-"}
                  </span>
                  <StatusPill status={order.status} />
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
