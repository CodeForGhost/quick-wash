import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/format";
import type { OrderWithDetails } from "@/lib/types";
import { StatusPill, cx } from "./patterns";
import { LinkSpinner } from "./pending";

/**
 * One order in a list. The order number is set in the mono face so a column of
 * them lines up and stays scannable next to a bag.
 */
export function OrderCard({
  order,
  href,
  showCustomer = false,
  trailing,
}: {
  order: OrderWithDetails;
  href: string;
  showCustomer?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-card border border-hairline bg-surface p-4 transition hover:border-ink-faint"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-sm font-semibold text-ink">{order.order_number}</p>
          {showCustomer ? (
            <p className="mt-0.5 truncate text-sm font-medium text-ink">{order.customer_name}</p>
          ) : null}
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {order.address_area ? order.address_area + " · " : ""}
            {order.bag_count} {order.bag_count === 1 ? "bag" : "bags"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {/* A tapped card is silent until the detail page arrives; this fills that gap. */}
          <LinkSpinner className="size-3.5 text-lagoon" />
          <StatusPill status={order.status} />
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3 text-xs text-ink-soft">
        <span>
          {formatDate(order.pickup_date)} · {order.pickup_time_slot}
        </span>
        <span className={cx("tabular font-semibold", order.price ? "text-ink" : "text-ink-faint")}>
          {order.price ? formatPrice(order.price) : "Price pending"}
        </span>
      </div>

      {trailing}
    </Link>
  );
}

/** FR-020: the recorded trail of every status change on an order. */
export function StatusTrail({
  entries,
}: {
  entries: Array<{ id: number; status: string; notes: string | null; created_at: string; changed_by_name: string | null }>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-faint">Nothing recorded yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < entries.length - 1 ? (
            <span aria-hidden className="absolute left-[3px] top-3 h-full w-px bg-hairline" />
          ) : null}
          <span aria-hidden className="relative z-10 mt-1.5 size-[7px] shrink-0 rounded-full bg-lagoon" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{entry.notes ?? entry.status}</p>
            <p className="tabular mt-0.5 text-xs text-ink-faint">
              <TrailTime value={entry.created_at} />
              {entry.changed_by_name ? " · " + entry.changed_by_name : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Rendered on the client so the timestamp lands in the reader's timezone. */
function TrailTime({ value }: { value: string }) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  const iso = Number.isNaN(date.getTime()) ? value : date.toISOString();
  return (
    <time dateTime={iso}>
      {Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
    </time>
  );
}
