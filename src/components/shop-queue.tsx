import Link from "next/link";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import type { OrderWithDetails } from "@/lib/types";
import { Card, EmptyState, StatusPill, cx } from "./patterns";

/**
 * A shop work queue. The shop works from the order number on the bag tag, so
 * that is what leads each row.
 */
export function ShopQueue({
  orders,
  empty,
  showPrice = true,
}: {
  orders: OrderWithDetails[];
  empty: { title: string; body: string };
  showPrice?: boolean;
}) {
  if (orders.length === 0) return <EmptyState title={empty.title} body={empty.body} />;

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id}>
          <Card className="transition hover:border-ink-faint">
            <Link href={`/shop/orders/${order.id}`} className="flex items-center gap-4 p-4">
              <span className="min-w-0 flex-1">
                <span className="tabular block text-sm font-bold text-ink">{order.order_number}</span>
                <span className="mt-0.5 block truncate font-medium text-ink">{order.customer_name}</span>
                <span className="mt-0.5 block text-sm text-ink-soft">
                  {order.actual_bag_count ?? order.bag_count}{" "}
                  {(order.actual_bag_count ?? order.bag_count) === 1 ? "bag" : "bags"}
                  {order.item_count ? ` · about ${order.item_count} items` : ""}
                </span>
                <span className="mt-1 block text-xs text-ink-faint">
                  {order.picked_up_at
                    ? "Collected " + formatDateTime(order.picked_up_at)
                    : "Pickup " + formatDate(order.pickup_date)}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <StatusPill status={order.status} />
                {showPrice ? (
                  <span
                    className={cx(
                      "tabular mt-2 block text-sm font-semibold",
                      order.price ? "text-ink" : "text-sun",
                    )}
                  >
                    {order.price ? formatPrice(order.price) : "Set price"}
                  </span>
                ) : null}
              </span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
