"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Props =
  /** Follow one order - the tracking page. */
  | { orderId: number; customerId?: never }
  /** Follow every order of one customer - home and the order list. */
  | { customerId: number; orderId?: never };

/**
 * FR-018: the customer sees a status change the moment it happens, without
 * reloading. Renders nothing; it listens on Supabase Realtime (a WebSocket)
 * for changes to the rows this page shows and asks Next to re-render the
 * page from the server when one arrives. The page's own data fetching is
 * untouched: the same server component reads the same rows, just again.
 *
 * It does not notify: that is Web Push (src/lib/push.ts, public/sw.js),
 * sent by the server so it reaches a phone whether or not a tab is open.
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
        () => router.refresh(),
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
