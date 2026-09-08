import "server-only";
import { supabaseServer } from "./supabase/server";
import { ERRORS, badRequest, conflict, forbidden, notFound } from "./errors";
import { notify, type NotificationEvent } from "./notifications";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  type LaundryOrder,
  type OrderStatus,
  type OrderWithDetails,
  type Role,
  type SessionUser,
  type StatusHistoryEntry,
} from "./types";

// --- State machine (SRS section 9) ------------------------------------------

/**
 * Allowed forward transitions. Orders may also be cancelled before collection.
 *
 * This table shapes the UI - which buttons a screen offers. The copy that
 * actually holds is `allowed_transition()` in supabase/schema.sql, because the
 * anon key ships to the browser and "the app already checked" is not a check.
 * Change one and change the other.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PICKUP_ASSIGNED", "CANCELLED"],
  PICKUP_ASSIGNED: ["PICKED_UP", "PENDING", "CANCELLED"],
  PICKED_UP: ["AT_LAUNDRY"],
  AT_LAUNDRY: ["WASHING"],
  WASHING: ["DRYING"],
  DRYING: ["IRONING"],
  IRONING: ["READY"],
  READY: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Index in the linear pipeline; -1 for CANCELLED. Used by the tracking view. */
export function statusIndex(status: OrderStatus): number {
  return (ORDER_STATUSES as readonly string[]).indexOf(status);
}

const EVENT_FOR_STATUS: Partial<Record<OrderStatus, NotificationEvent>> = {
  PICKUP_ASSIGNED: "AGENT_ASSIGNED",
  PICKED_UP: "PICKED_UP",
  AT_LAUNDRY: "RECEIVED",
  WASHING: "PROCESSING_STARTED",
  READY: "READY",
  OUT_FOR_DELIVERY: "DELIVERY_ASSIGNED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

/** Maps a raise from a schema.sql function onto the app's error envelope. */
function fromRpc(message: string): Error {
  if (message.includes("FORBIDDEN")) return forbidden();
  if (message.includes("NOT_SIGNED_IN")) return forbidden();
  if (message.includes("NOT_FOUND")) return notFound();
  if (message.includes("BAD_TRANSITION")) return conflict(ERRORS.invalidTransition);
  if (message.includes("ALREADY_DONE")) return conflict("This order is already completed.");
  if (message.includes("BAD_ADDRESS")) return badRequest(ERRORS.invalidAddress);
  if (message.includes("BAD_BAG_COUNT")) return badRequest("Please enter at least one laundry bag.");
  if (message.includes("BAD_PRICE")) return badRequest("Please enter a valid price.");
  if (message.includes("AGENT_UNAVAILABLE")) return badRequest(ERRORS.agentUnavailable);
  return new Error(message);
}

// --- Queries -----------------------------------------------------------------

/**
 * Everything the order screens show, in one round trip. The two agent columns
 * both point at `users`, so each embed names its foreign key explicitly.
 */
const ORDER_SELECT = `
  *,
  customer:users!laundry_orders_customer_id_fkey ( name, phone ),
  pickup_agent:users!laundry_orders_pickup_agent_id_fkey ( name, phone ),
  delivery_agent:users!laundry_orders_delivery_agent_id_fkey ( name ),
  shop:laundry_shops!laundry_orders_laundry_shop_id_fkey ( name ),
  address:addresses!laundry_orders_pickup_address_id_fkey ( label, address, area, landmark, phone )
`;

type OrderRow = LaundryOrder & {
  customer: { name: string; phone: string } | null;
  pickup_agent: { name: string; phone: string } | null;
  delivery_agent: { name: string } | null;
  shop: { name: string } | null;
  address: {
    label: string;
    address: string;
    area: string | null;
    landmark: string | null;
    phone: string | null;
  } | null;
};

/** Flattens the embeds back into the shape every screen already expects. */
function withDetails(row: OrderRow): OrderWithDetails {
  const { customer, pickup_agent, delivery_agent, shop, address, ...order } = row;
  return {
    ...order,
    customer_name: customer?.name ?? "",
    customer_phone: customer?.phone ?? "",
    pickup_agent_name: pickup_agent?.name ?? null,
    pickup_agent_phone: pickup_agent?.phone ?? null,
    delivery_agent_name: delivery_agent?.name ?? null,
    shop_name: shop?.name ?? null,
    address_label: address?.label ?? "",
    address_line: address?.address ?? "",
    address_area: address?.area ?? null,
    address_landmark: address?.landmark ?? null,
    address_phone: address?.phone ?? null,
  };
}

export async function getOrder(id: number): Promise<OrderWithDetails | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("laundry_orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  return data ? withDetails(data as unknown as OrderRow) : undefined;
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderWithDetails | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("laundry_orders")
    .select(ORDER_SELECT)
    .eq("order_number", orderNumber)
    .maybeSingle();
  return data ? withDetails(data as unknown as OrderRow) : undefined;
}

export interface OrderFilter {
  customerId?: number;
  pickupAgentId?: number;
  deliveryAgentId?: number;
  agentId?: number;
  shopId?: number;
  statuses?: OrderStatus[];
  pickupDate?: string;
  search?: string;
  limit?: number;
}

export async function listOrders(filter: OrderFilter = {}): Promise<OrderWithDetails[]> {
  const supabase = await supabaseServer();
  let query = supabase.from("laundry_orders").select(ORDER_SELECT);

  if (filter.customerId) query = query.eq("customer_id", filter.customerId);
  if (filter.pickupAgentId) query = query.eq("pickup_agent_id", filter.pickupAgentId);
  if (filter.deliveryAgentId) query = query.eq("delivery_agent_id", filter.deliveryAgentId);
  if (filter.agentId) {
    query = query.or(`pickup_agent_id.eq.${filter.agentId},delivery_agent_id.eq.${filter.agentId}`);
  }
  if (filter.shopId) {
    query = query.or(`laundry_shop_id.eq.${filter.shopId},laundry_shop_id.is.null`);
  }
  if (filter.statuses?.length) query = query.in("status", filter.statuses);
  if (filter.pickupDate) query = query.eq("pickup_date", filter.pickupDate);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(filter.limit ?? 200);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as OrderRow[]).map(withDetails);
  if (!filter.search) return rows;

  /*
   * The search runs over the order number and the customer's name and phone.
   * Two of those live on an embed, and filtering an embedded column in
   * PostgREST turns the join inner - which would drop every order with no
   * agent assigned. So the match happens here, over the already-filtered set.
   */
  const needle = filter.search.toLowerCase();
  return rows.filter(
    (o) =>
      o.order_number.toLowerCase().includes(needle) ||
      o.customer_name.toLowerCase().includes(needle) ||
      o.customer_phone.toLowerCase().includes(needle),
  );
}

export async function getStatusHistory(orderId: number): Promise<StatusHistoryEntry[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("order_status_history")
    .select(`*, changed_by_user:users!order_status_history_changed_by_fkey ( name )`)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  type Row = StatusHistoryEntry & { changed_by_user: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map(({ changed_by_user, ...entry }) => ({
    ...entry,
    changed_by_name: changed_by_user?.name ?? null,
  }));
}

// --- Access control (BR-004, BR-008, SRS section 12) -------------------------

/**
 * The same rule as `can_view_order()` in supabase/schema.sql. This one shapes
 * the UI and gives a clean 403; that one is the lock.
 */
export function canViewOrder(user: SessionUser, order: LaundryOrder): boolean {
  switch (user.role) {
    case "ADMIN":
      return true;
    case "CUSTOMER":
      return order.customer_id === user.id;
    case "PICKUP_AGENT":
      return order.pickup_agent_id === user.id || order.delivery_agent_id === user.id;
    case "SHOP_STAFF":
      return !user.shop_id || order.laundry_shop_id === user.shop_id || order.laundry_shop_id === null;
    default:
      return false;
  }
}

export function assertCanView(user: SessionUser, order: LaundryOrder): void {
  if (!canViewOrder(user, order)) throw forbidden();
}

/** Which roles may move an order into a given status (SRS section 12). */
const ROLES_FOR_STATUS: Record<OrderStatus, Role[]> = {
  PENDING: ["ADMIN"],
  PICKUP_ASSIGNED: ["ADMIN"],
  PICKED_UP: ["PICKUP_AGENT", "ADMIN"],
  AT_LAUNDRY: ["SHOP_STAFF", "ADMIN"],
  WASHING: ["SHOP_STAFF", "ADMIN"],
  DRYING: ["SHOP_STAFF", "ADMIN"],
  IRONING: ["SHOP_STAFF", "ADMIN"],
  READY: ["SHOP_STAFF", "ADMIN"],
  OUT_FOR_DELIVERY: ["ADMIN"],
  DELIVERED: ["PICKUP_AGENT", "ADMIN"],
  CANCELLED: ["CUSTOMER", "ADMIN"],
};

// --- Mutations ---------------------------------------------------------------

export interface CreateOrderInput {
  customerId: number;
  addressId: number;
  pickupDate: string;
  pickupTimeSlot: string;
  bagCount: number;
  itemCount?: number | null;
  notes?: string | null;
  /**
   * Customers may only book from today onwards. Backdating is allowed for the
   * seeder and for an administrator recording an order that already happened.
   */
  allowPastDate?: boolean;
}

/** FR-005 / FR-006: creates a PENDING order and records the first history row. */
export async function createOrder(
  input: CreateOrderInput,
  actorId: number,
): Promise<OrderWithDetails> {
  void actorId; // the function reads the caller from the session, not the argument

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate)) throw badRequest(ERRORS.invalidPickupDate);
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  if (!input.allowPastDate && input.pickupDate < todayStr) throw badRequest(ERRORS.invalidPickupDate);
  if (!Number.isInteger(input.bagCount) || input.bagCount < 1) {
    throw badRequest("Please enter at least one laundry bag.");
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_order", {
    p_address_id: input.addressId,
    p_pickup_date: input.pickupDate,
    p_pickup_time_slot: input.pickupTimeSlot,
    p_bag_count: input.bagCount,
    p_item_count: input.itemCount ?? null,
    p_notes: input.notes ?? null,
    p_customer_id: input.customerId,
  });
  if (error) throw fromRpc(error.message);

  const order = (await getOrder(Number(data)))!;
  await notify("NEW_ORDER", order);
  return order;
}

export interface TransitionOptions {
  notes?: string | null;
  actualBagCount?: number | null;
  /** Set when the caller has already performed its own authorization. */
  skipAuthorization?: boolean;
}

/**
 * Moves an order to a new status, enforcing the state machine (BR-006),
 * role permissions (BR-005) and history recording (BR-007). The checks here
 * turn a bad request into a clean message; transition_order() in the schema
 * repeats them, and that is the one that cannot be bypassed.
 */
export async function transitionOrder(
  orderId: number,
  to: OrderStatus,
  user: SessionUser,
  options: TransitionOptions = {},
): Promise<OrderWithDetails> {
  const order = await getOrder(orderId);
  if (!order) throw notFound();

  // BR-009: a completed order can only be touched by an administrator.
  if (order.status === "DELIVERED" && user.role !== "ADMIN") {
    throw conflict("This order is already completed.");
  }
  if (!options.skipAuthorization) {
    assertCanView(user, order);
    if (!ROLES_FOR_STATUS[to]?.includes(user.role)) throw forbidden();
  }
  // BR-004: an agent may only update orders assigned to them.
  if (user.role === "PICKUP_AGENT") {
    const assigned = to === "DELIVERED" ? order.delivery_agent_id : order.pickup_agent_id;
    if (assigned !== user.id) throw forbidden();
  }
  if (order.status === to) return order;
  if (!canTransition(order.status, to)) throw conflict(ERRORS.invalidTransition);

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_to: to,
    p_notes: options.notes ?? STATUS_LABELS[to],
    p_actual_bags: options.actualBagCount ?? null,
  });
  if (error) throw fromRpc(error.message);

  const updated = (await getOrder(orderId))!;
  const event = EVENT_FOR_STATUS[to];
  if (event) await notify(event, updated);
  return updated;
}

/** FR-007: only an administrator assigns a pickup agent (BR-003). */
export async function assignPickupAgent(
  orderId: number,
  agentId: number,
  admin: SessionUser,
): Promise<OrderWithDetails> {
  const order = await getOrder(orderId);
  if (!order) throw notFound();
  if (order.status !== "PENDING" && order.status !== "PICKUP_ASSIGNED") {
    throw conflict("This order is already past the pickup stage.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("assign_agent", {
    p_order_id: orderId,
    p_agent_id: agentId,
    p_delivery: false,
  });
  if (error) throw fromRpc(error.message);

  if (order.status === "PENDING") {
    return transitionOrder(orderId, "PICKUP_ASSIGNED", admin, { notes: "Pickup agent assigned" });
  }
  const updated = (await getOrder(orderId))!;
  await notify("AGENT_ASSIGNED", updated);
  return updated;
}

/** FR-016: assigns a delivery agent, moving READY -> OUT_FOR_DELIVERY. */
export async function assignDeliveryAgent(
  orderId: number,
  agentId: number,
  admin: SessionUser,
): Promise<OrderWithDetails> {
  const order = await getOrder(orderId);
  if (!order) throw notFound();
  if (order.status !== "READY" && order.status !== "OUT_FOR_DELIVERY") {
    throw conflict("Only a ready order can be assigned for delivery.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("assign_agent", {
    p_order_id: orderId,
    p_agent_id: agentId,
    p_delivery: true,
  });
  if (error) throw fromRpc(error.message);

  if (order.status === "READY") {
    return transitionOrder(orderId, "OUT_FOR_DELIVERY", admin, { notes: "Delivery agent assigned" });
  }
  const updated = (await getOrder(orderId))!;
  await notify("DELIVERY_ASSIGNED", updated);
  return updated;
}

/** FR-014 / BR-010: shop staff and administrators set the final price. */
export async function setPrice(
  orderId: number,
  price: number,
  user: SessionUser,
): Promise<OrderWithDetails> {
  const order = await getOrder(orderId);
  if (!order) throw notFound();
  if (user.role !== "SHOP_STAFF" && user.role !== "ADMIN") throw forbidden();
  assertCanView(user, order);
  if (!Number.isFinite(price) || price < 0) throw badRequest("Please enter a valid price.");
  if (order.status === "DELIVERED" && user.role !== "ADMIN") {
    throw conflict("This order is already completed.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_order_price", { p_order_id: orderId, p_price: price });
  if (error) throw fromRpc(error.message);
  return (await getOrder(orderId))!;
}

/** Customers may cancel only before the laundry has been collected. */
export async function cancelOrder(
  orderId: number,
  user: SessionUser,
  reason?: string,
): Promise<OrderWithDetails> {
  const order = await getOrder(orderId);
  if (!order) throw notFound();
  assertCanView(user, order);
  if (user.role !== "CUSTOMER" && user.role !== "ADMIN") throw forbidden();
  if (!canTransition(order.status, "CANCELLED")) {
    throw conflict("This order can no longer be cancelled.");
  }
  return transitionOrder(orderId, "CANCELLED", user, {
    notes: reason ? "Cancelled: " + reason : "Order cancelled",
    skipAuthorization: true,
  });
}

/** FR-023: the status counts shown on the admin dashboard. */
export async function statusCounts(pickupDate?: string): Promise<Record<string, number>> {
  const supabase = await supabaseServer();
  let query = supabase.from("laundry_orders").select("status");
  if (pickupDate) query = query.eq("pickup_date", pickupDate);
  const { data, error } = await query;
  if (error) throw error;

  // PostgREST has no GROUP BY. At this size counting here is cheaper than a
  // view per filter; if the board grows, move it into one.
  const counts: Record<string, number> = { CANCELLED: 0 };
  for (const status of ORDER_STATUSES) counts[status] = 0;
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}
