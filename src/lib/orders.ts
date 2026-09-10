import "server-only";
import { supabaseServer } from "./supabase/server";
import { ERRORS, badRequest, conflict, forbidden, notFound } from "./errors";
import { today } from "./format";
import { notify, type NotificationEvent } from "./notifications";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  type LaundryOrder,
  type OrderStatus,
  type OrderWithDetails,
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
  if (message.includes("BAD_STAGE_PICKUP")) {
    return conflict("This order is already past the pickup stage.");
  }
  if (message.includes("BAD_STAGE_DELIVERY")) {
    return conflict("Only a ready order can be assigned for delivery.");
  }
  return new Error(message);
}

/**
 * The write functions return the order they just wrote, in the shape
 * OrderWithDetails describes (order_details() in schema.sql). Each of these
 * calls used to be followed by a read of the same order over the network.
 */
function fromRpcRow(data: unknown): OrderWithDetails {
  if (!data || typeof data !== "object") throw notFound();
  return data as OrderWithDetails;
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
  // Puttalam's today, not the host's: on a UTC server the first five and a half
  // hours of every local day would otherwise reject that day as already past.
  if (!input.allowPastDate && input.pickupDate < today()) throw badRequest(ERRORS.invalidPickupDate);
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

  const order = fromRpcRow(data);
  await notify("NEW_ORDER", order);
  return order;
}

export interface TransitionOptions {
  notes?: string | null;
  actualBagCount?: number | null;
}

/**
 * Moves an order to a new status, enforcing the state machine (BR-006),
 * role permissions (BR-005) and history recording (BR-007).
 *
 * All of that happens inside transition_order(), which re-checks the caller,
 * the state machine and BR-004 and BR-009 against the row it has just locked,
 * and returns the order it wrote. This used to read the order first to run
 * the same checks in TypeScript for the sake of a readable message, and read
 * it again afterwards for the joined shape - three network calls where the
 * schema needs one. fromRpc() turns each raise back into the same message.
 */
export async function transitionOrder(
  orderId: number,
  to: OrderStatus,
  user: SessionUser,
  options: TransitionOptions = {},
): Promise<OrderWithDetails> {
  void user; // the function reads the caller from the session, not the argument

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_to: to,
    p_notes: options.notes ?? STATUS_LABELS[to],
    p_actual_bags: options.actualBagCount ?? null,
  });
  if (error) throw fromRpc(error.message);

  const updated = fromRpcRow(data);
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
  const supabase = await supabaseServer();
  // assign_agent() rejects an order past the pickup stage itself, so the
  // check and the write are one call and cannot land out of order.
  const { data, error } = await supabase.rpc("assign_agent", {
    p_order_id: orderId,
    p_agent_id: agentId,
    p_delivery: false,
  });
  if (error) throw fromRpc(error.message);

  const assigned = fromRpcRow(data);
  if (assigned.status === "PENDING") {
    return transitionOrder(orderId, "PICKUP_ASSIGNED", admin, { notes: "Pickup agent assigned" });
  }
  await notify("AGENT_ASSIGNED", assigned);
  return assigned;
}

/** FR-016: assigns a delivery agent, moving READY -> OUT_FOR_DELIVERY. */
export async function assignDeliveryAgent(
  orderId: number,
  agentId: number,
  admin: SessionUser,
): Promise<OrderWithDetails> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("assign_agent", {
    p_order_id: orderId,
    p_agent_id: agentId,
    p_delivery: true,
  });
  if (error) throw fromRpc(error.message);

  const assigned = fromRpcRow(data);
  if (assigned.status === "READY") {
    return transitionOrder(orderId, "OUT_FOR_DELIVERY", admin, { notes: "Delivery agent assigned" });
  }
  await notify("DELIVERY_ASSIGNED", assigned);
  return assigned;
}

/** FR-014 / BR-010: shop staff and administrators set the final price. */
export async function setPrice(
  orderId: number,
  price: number,
  user: SessionUser,
): Promise<OrderWithDetails> {
  void user; // set_order_price() checks the role and BR-009 against the locked row
  // Worth catching here: NaN would reach Postgres as a null price.
  if (!Number.isFinite(price) || price < 0) throw badRequest("Please enter a valid price.");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("set_order_price", {
    p_order_id: orderId,
    p_price: price,
  });
  if (error) throw fromRpc(error.message);
  return fromRpcRow(data);
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
  });
}

/** FR-023: the status counts shown on the admin dashboard. */
export async function statusCounts(pickupDate?: string): Promise<Record<string, number>> {
  const supabase = await supabaseServer();

  // PostgREST has no GROUP BY, so the grouping is a view - as it is for
  // agent_workload and customer_summary. This used to select the status
  // column of every order and count the rows here, which meant dragging the
  // whole table over the wire for eleven numbers. Both views are
  // security_invoker, so shop staff still count only their own shop's orders.
  // The column is `total`, not `count`: PostgREST reads a bare `count` in a
  // select list as its own aggregate.
  const { data, error } = pickupDate
    ? await supabase
        .from("order_status_counts_by_date")
        .select("status, total")
        .eq("pickup_date", pickupDate)
    : await supabase.from("order_status_counts").select("status, total");
  if (error) throw error;

  const counts: Record<string, number> = { CANCELLED: 0 };
  for (const status of ORDER_STATUSES) counts[status] = 0;
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + row.total;
  return counts;
}
