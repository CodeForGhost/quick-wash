import type { LaundryOrder } from "./types";

/*
 * The SRS section 19 recipient matrix, kept free of any Supabase import so
 * the seeder can raise the same notifications the app does.
 */

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

export type Audience = "customer" | "pickup_agent" | "delivery_agent" | "shop";

interface EventSpec {
  title: string;
  body: (order: LaundryOrder) => string;
  to: Audience[];
}

// The recipient matrix in SRS section 19.
export const EVENTS: Record<NotificationEvent, EventSpec> = {
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

