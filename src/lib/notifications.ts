import { all, run } from "./db";
import type { LaundryOrder, Notification } from "./types";

/** Notification events from SRS section 19. */
export type NotificationEvent =
  | "NEW_ORDER"
  | "AGENT_ASSIGNED"
  | "PICKED_UP"
  | "RECEIVED"
  | "PROCESSING_STARTED"
  | "READY"
  | "DELIVERY_ASSIGNED"
  | "DELIVERED"
  | "CANCELLED";

type Audience = "customer" | "pickup_agent" | "delivery_agent" | "shop";

interface EventSpec {
  title: string;
  body: (order: LaundryOrder) => string;
  to: Audience[];
}

// The recipient matrix in SRS section 19.
const EVENTS: Record<NotificationEvent, EventSpec> = {
  NEW_ORDER: {
    title: "Pickup requested",
    body: (o) => `Order ${o.order_number} was created for ${o.pickup_date}, ${o.pickup_time_slot}.`,
    to: ["customer", "shop"],
  },
  AGENT_ASSIGNED: {
    title: "Pickup agent assigned",
    body: (o) => `A pickup agent is on the way for order ${o.order_number}.`,
    to: ["customer", "pickup_agent"],
  },
  PICKED_UP: {
    title: "Laundry collected",
    body: (o) => `Your laundry for order ${o.order_number} has been collected.`,
    to: ["customer", "shop"],
  },
  RECEIVED: {
    title: "Laundry received at shop",
    body: (o) => `Order ${o.order_number} has arrived at the laundry shop.`,
    to: ["customer"],
  },
  PROCESSING_STARTED: {
    title: "Processing started",
    body: (o) => `Order ${o.order_number} is now being processed.`,
    to: ["customer"],
  },
  READY: {
    title: "Laundry ready",
    body: (o) => `Order ${o.order_number} is ready and will be delivered soon.`,
    to: ["customer"],
  },
  DELIVERY_ASSIGNED: {
    title: "Out for delivery",
    body: (o) => `Order ${o.order_number} is out for delivery.`,
    to: ["customer", "delivery_agent"],
  },
  DELIVERED: {
    title: "Laundry delivered",
    body: (o) => `Order ${o.order_number} has been delivered. Thank you!`,
    to: ["customer"],
  },
  CANCELLED: {
    title: "Order cancelled",
    body: (o) => `Order ${o.order_number} was cancelled.`,
    to: ["customer", "shop"],
  },
};

function recipients(order: LaundryOrder, audiences: Audience[]): number[] {
  const ids = new Set<number>();
  for (const audience of audiences) {
    if (audience === "customer") ids.add(order.customer_id);
    if (audience === "pickup_agent" && order.pickup_agent_id) ids.add(order.pickup_agent_id);
    if (audience === "delivery_agent" && order.delivery_agent_id) ids.add(order.delivery_agent_id);
    if (audience === "shop") {
      // Shop notifications go to every active staff member of the assigned shop.
      const staff = order.laundry_shop_id
        ? all<{ id: number }>(
            "SELECT id FROM users WHERE role = 'SHOP_STAFF' AND is_active = 1 AND shop_id = ?",
            order.laundry_shop_id,
          )
        : all<{ id: number }>("SELECT id FROM users WHERE role = 'SHOP_STAFF' AND is_active = 1");
      staff.forEach((s) => ids.add(s.id));
    }
  }
  return [...ids];
}

/**
 * Records in-app notifications for an event. For the MVP these are stored and
 * shown in the app; a WhatsApp/SMS provider can be plugged in here later.
 */
export function notify(event: NotificationEvent, order: LaundryOrder): void {
  const spec = EVENTS[event];
  if (!spec) return;
  const body = spec.body(order);
  for (const userId of recipients(order, spec.to)) {
    run(
      "INSERT INTO notifications (user_id, order_id, event, title, body) VALUES (?, ?, ?, ?, ?)",
      userId,
      order.id,
      event,
      spec.title,
      body,
    );
  }
}

export function listNotifications(userId: number, limit = 30): Notification[] {
  return all<Notification>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    userId,
    limit,
  );
}

export function unreadCount(userId: number): number {
  const rows = all<{ c: number }>(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0",
    userId,
  );
  return rows[0]?.c ?? 0;
}

export function markAllRead(userId: number): void {
  run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", userId);
}
