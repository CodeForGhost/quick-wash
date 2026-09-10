import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { Card, EmptyState, PageTitle, StatusPill, cx } from "@/components/patterns";
import { formatDate, formatPrice } from "@/lib/format";
import { listOrders, statusCounts } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";

export const metadata = { title: "Orders · QuickWash" };

type Props = { searchParams: Promise<{ status?: string; q?: string; date?: string }> };

/** SRS 13.4 screen 2: every order, filterable. */
export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireRole("ADMIN");
  const filters = await searchParams;

  const status = (ORDER_STATUSES as readonly string[]).includes(filters.status ?? "")
    ? (filters.status as OrderStatus)
    : filters.status === "CANCELLED"
      ? ("CANCELLED" as OrderStatus)
      : undefined;

  const [orders, counts] = await Promise.all([
    listOrders({
      statuses: status ? [status] : undefined,
      search: filters.q || undefined,
      pickupDate: filters.date || undefined,
    }),
    statusCounts(),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Everything"
        title="Orders"
        subtitle={`${orders.length} ${orders.length === 1 ? "order" : "orders"}${status ? " at " + STATUS_LABELS[status] : ""}.`}
      />

      <form className="mb-5 flex flex-wrap gap-2" action="/admin/orders">
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Order number, name or phone"
          className="min-w-56 flex-1 rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-lagoon focus:outline-none"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
        >
          Search
        </button>
      </form>

      {/* Status filter chips carry their own counts, so the filter doubles as a summary. */}
      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip href="/admin/orders" label="All" count={orders.length} active={!status} />
        {[...ORDER_STATUSES, "CANCELLED" as const].map((option) => (
          <FilterChip
            key={option}
            href={`/admin/orders?status=${option}`}
            label={STATUS_LABELS[option]}
            count={counts[option] ?? 0}
            active={status === option}
          />
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders match"
          body="Try a different status, or clear the search to see everything."
        />
      ) : (
        <Card className="divide-y divide-hairline overflow-hidden">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:bg-ground/40"
            >
              <span className="tabular w-32 shrink-0 text-sm font-semibold text-ink">{order.order_number}</span>
              <span className="min-w-40 flex-1">
                <span className="block truncate font-medium text-ink">{order.customer_name}</span>
                <span className="tabular block truncate text-xs text-ink-faint">{order.customer_phone}</span>
              </span>
              <span className="hidden w-40 shrink-0 text-sm text-ink-soft sm:block">
                {formatDate(order.pickup_date)}
                <span className="block text-xs text-ink-faint">{order.pickup_time_slot}</span>
              </span>
              <span className="hidden w-28 shrink-0 text-sm text-ink-soft md:block">
                {order.pickup_agent_name ?? <span className="text-ink-faint">Unassigned</span>}
              </span>
              <span className="tabular w-24 shrink-0 text-right text-sm font-semibold text-ink">
                {order.price ? formatPrice(order.price) : "-"}
              </span>
              <StatusPill status={order.status} />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink-soft hover:border-ink-faint",
      )}
    >
      {label}
      <span className={cx("tabular", active ? "text-white/60" : "text-ink-faint")}>{count}</span>
    </Link>
  );
}
