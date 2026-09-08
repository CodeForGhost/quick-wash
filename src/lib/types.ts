// Domain types shared by the server and the client components.

export const ROLES = ["CUSTOMER", "PICKUP_AGENT", "SHOP_STAFF", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** SRS section 9 - the primary order state machine, in pipeline order. */
export const ORDER_STATUSES = [
  "PENDING",
  "PICKUP_ASSIGNED",
  "PICKED_UP",
  "AT_LAUNDRY",
  "WASHING",
  "DRYING",
  "IRONING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number] | "CANCELLED";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pickup Requested",
  PICKUP_ASSIGNED: "Pickup Assigned",
  PICKED_UP: "Clothes Collected",
  AT_LAUNDRY: "At Laundry Shop",
  WASHING: "Washing",
  DRYING: "Drying",
  IRONING: "Ironing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Statuses laundry shop staff drive (FR-012, FR-013, FR-015). */
export const SHOP_STATUSES = ["AT_LAUNDRY", "WASHING", "DRYING", "IRONING", "READY"] as const;

export const TIME_SLOTS = [
  "08:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 02:00 PM",
  "02:00 PM - 04:00 PM",
  "04:00 PM - 06:00 PM",
] as const;

export interface User {
  id: number;
  /** The Supabase Auth account behind this person. Null only mid-migration. */
  auth_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  shop_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: number;
  user_id: number;
  label: string;
  address: string;
  area: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface LaundryShop {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LaundryOrder {
  id: number;
  order_number: string;
  customer_id: number;
  pickup_agent_id: number | null;
  delivery_agent_id: number | null;
  laundry_shop_id: number | null;
  status: OrderStatus;
  pickup_address_id: number;
  pickup_date: string;
  pickup_time_slot: string;
  bag_count: number;
  item_count: number | null;
  actual_bag_count: number | null;
  price: number | null;
  notes: string | null;
  picked_up_at: string | null;
  received_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** An order joined with the names it is almost always displayed with. */
export interface OrderWithDetails extends LaundryOrder {
  customer_name: string;
  customer_phone: string;
  pickup_agent_name: string | null;
  pickup_agent_phone: string | null;
  delivery_agent_name: string | null;
  shop_name: string | null;
  address_label: string;
  address_line: string;
  address_area: string | null;
  address_landmark: string | null;
  address_phone: string | null;
}

export interface StatusHistoryEntry {
  id: number;
  order_id: number;
  status: OrderStatus;
  changed_by: number | null;
  changed_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface PickupRoute {
  id: number;
  name: string | null;
  agent_id: number;
  agent_name: string;
  route_date: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  order_count: number;
  created_at: string;
  updated_at: string;
}

export interface RouteOrder {
  id: number;
  route_id: number;
  order_id: number;
  sequence: number;
  status: string;
  order_number: string;
  customer_name: string;
  bag_count: number;
  address_line: string;
  order_status: OrderStatus;
}

export interface Notification {
  id: number;
  user_id: number;
  order_id: number | null;
  event: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface SessionUser {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  shop_id: number | null;
}
