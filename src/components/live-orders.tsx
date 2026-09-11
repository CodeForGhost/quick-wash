"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

/** The little a page needs to know about each order it is showing. */
export type LiveOrder = { id: number; order_number: string; status: OrderStatus };

type Props = {
  /** The orders on this page, so a change can be told from a mere touch. */
  orders: LiveOrder[];
} & (
  /** Follow one order - the tracking page. */
  | { orderId: number; customerId?: never }
  /** Follow every order of one customer - home and the order list. */
  | { customerId: number; orderId?: never }
);

/**
 * FR-018: the customer sees a status change the moment it happens, without
 * reloading. Renders nothing; it listens on Supabase Realtime (a WebSocket)
 * for changes to the rows this page shows and asks Next to re-render the
 * page from the server when one arrives. The page's own data fetching is
 * untouched: the same server component reads the same rows, just again.
 *
 * When the change is a new status - not a price, not a touch - and the
 * customer has allowed it (see NotifyOptIn), it also raises a browser
 * notification, which is what reaches them when this tab is in the
 * background or the phone is in a pocket.
 *
 * What the socket is allowed to send is decided by the "orders follow
 * BR-008" policy in schema.sql, so a customer only ever hears about their
 * own orders. The filter below is for economy, not security.
 *
 * On reconnect - the phone slept, the network dropped - it refreshes once
 * more, because a change that happened while the socket was down was never
 * sent and never will be.
 */
export function LiveOrders(props: Props) {
  const router = useRouter();
  const filter =
    props.orderId !== undefined ? `id=eq.${props.orderId}` : `customer_id=eq.${props.customerId}`;

  // The last status seen per order. Seeded from the server render and kept
  // current from the socket, because a change event carries only the new
  // row - the old one is just its id.
  const known = useRef(new Map<number, LiveOrder>());
  for (const order of props.orders) known.current.set(order.id, order);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let subscribedBefore = false;
    let cancelled = false;

    // A unique topic per mount. channel() hands back an existing channel of
    // the same name, and React mounts twice in development: the second mount
    // would inherit the channel the first is still tearing down and never
    // truly subscribe. The same happens in production on a quick back-and-
    // forth between pages.
    const channel = supabase
      .channel(`orders:${filter}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "laundry_orders", filter },
        (payload) => {
          const row = payload.new as { id: number; order_number: string; status: OrderStatus };
          const seen = known.current.get(row.id);
          if (seen && seen.status !== row.status) notifyStatus(row);
          known.current.set(row.id, { id: row.id, order_number: row.order_number, status: row.status });
          router.refresh();
        },
      );

    // Make sure the session has been read from the cookie before joining, so
    // the first join already carries the customer's token rather than the
    // anonymous key (which the policy would answer with nothing).
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribedBefore) router.refresh();
        subscribedBefore = true;
      });
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [filter, router]);

  return null;
}

/** One notification per order; a newer status replaces the one still showing. */
function notifyStatus(order: LiveOrder) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const notification = new Notification(`Order ${order.order_number}`, {
    body: `Your laundry is now: ${STATUS_LABELS[order.status]}`,
    tag: `order-${order.id}`,
  });
  notification.onclick = () => {
    window.focus();
    window.location.assign(`/customer/orders/${order.id}`);
    notification.close();
  };
}
