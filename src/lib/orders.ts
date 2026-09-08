import { all, db, get, now, run } from "./db";
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

/** Allowed forward transitions. Orders may also be cancelled before collection. */
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

// Timestamp columns stamped when an order reaches a given status.
const TIMESTAMP_COLUMN: Partial<Record<OrderStatus, string>> = {
  PICKED_UP: "picked_up_at",
  AT_LAUNDRY: "received_at",
  READY: "ready_at",
  DELIVERED: "delivered_at",
  CANCELLED: "cancelled_at",
};

// --- Order numbers (BR-002) --------------------------------------------------

/**
 * Generates the next order number, e.g. PU-2026-0001. Callers run this inside
 * the same transaction as the insert, so numbers stay unique and gap-free.
 */
function nextOrderNumber(): string {
  const year = new Date().getFullYear();
  run("INSERT INTO order_counters (year, last) VALUES (?, 0) ON CONFLICT(year) DO NOTHING", year);
  run("UPDATE order_counters SET last = last + 1 WHERE year = ?", year);
  const row = get<{ last: number }>("SELECT last FROM order_counters WHERE year = ?", year);
  return "PU-" + year + "-" + String(row?.last ?? 1).padStart(4, "0");
}

// --- Queries -----------------------------------------------------------------

const ORDER_SELECT = `
  SELECT o.*,
         c.name  AS customer_name,
         c.phone AS customer_phone,
         pa.name  AS pickup_agent_name,
         pa.phone AS pickup_agent_phone,
         da.name  AS delivery_agent_name,
         s.name   AS shop_name,
         a.label    AS address_label,
         a.address  AS address_line,
         a.area     AS address_area,
         a.landmark AS address_landmark,
         a.phone    AS address_phone
  FROM laundry_orders o
  JOIN users c     ON c.id = o.customer_id
  JOIN addresses a ON a.id = o.pickup_address_id
  LEFT JOIN users pa        ON pa.id = o.pickup_agent_id
  LEFT JOIN users da        ON da.id = o.delivery_agent_id
  LEFT JOIN laundry_shops s ON s.id = o.laundry_shop_id
`;

export function getOrder(id: number): OrderWithDetails | undefined {
  return get<OrderWithDetails>(ORDER_SELECT + " WHERE o.id = ?", id);
}

export function getOrderByNumber(orderNumber: string): OrderWithDetails | undefined {
  return get<OrderWithDetails>(ORDER_SELECT + " WHERE o.order_number = ?", orderNumber);
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

export function listOrders(filter: OrderFilter = {}): OrderWithDetails[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.customerId) {
    where.push("o.customer_id = ?");
    params.push(filter.customerId);
  }
  if (filter.pickupAgentId) {
    where.push("o.pickup_agent_id = ?");
    params.push(filter.pickupAgentId);
  }
  if (filter.deliveryAgentId) {
    where.push("o.delivery_agent_id = ?");
    params.push(filter.deliveryAgentId);
  }
  if (filter.agentId) {
    where.push("(o.pickup_agent_id = ? OR o.delivery_agent_id = ?)");
    params.push(filter.agentId, filter.agentId);
  }
  if (filter.shopId) {
    where.push("(o.laundry_shop_id = ? OR o.laundry_shop_id IS NULL)");
    params.push(filter.shopId);
  }
  if (filter.statuses?.length) {
    where.push("o.status IN (" + filter.statuses.map(() => "?").join(",") + ")");
    params.push(...filter.statuses);
  }
  if (filter.pickupDate) {
    where.push("o.pickup_date = ?");
    params.push(filter.pickupDate);
  }
  if (filter.search) {
    where.push("(o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)");
    const like = "%" + filter.search + "%";
    params.push(like, like, like);
  }

  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const limit = filter.limit ?? 200;
  return all<OrderWithDetails>(
    ORDER_SELECT + clause + " ORDER BY o.created_at DESC, o.id DESC LIMIT ?",
    ...params,
    limit,
  );
}

export function getStatusHistory(orderId: number): StatusHistoryEntry[] {
  return all<StatusHistoryEntry>(
    `SELECT h.*, u.name AS changed_by_name
     FROM order_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ?
     ORDER BY h.created_at ASC, h.id ASC`,
    orderId,
  );
}

// --- Access control (BR-004, BR-008, SRS section 12) -------------------------

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
export function createOrder(input: CreateOrderInput, actorId: number): OrderWithDetails {
  // BR-001: the pickup address must exist and belong to the customer.
  const address = get<{ id: number }>(
    "SELECT id FROM addresses WHERE id = ? AND user_id = ? AND is_deleted = 0",
    input.addressId,
    input.customerId,
  );
  if (!address) throw badRequest(ERRORS.invalidAddress);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate)) throw badRequest(ERRORS.invalidPickupDate);
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  if (!input.allowPastDate && input.pickupDate < todayStr) throw badRequest(ERRORS.invalidPickupDate);
  if (!Number.isInteger(input.bagCount) || input.bagCount < 1) {
    throw badRequest("Please enter at least one laundry bag.");
  }

  // For the MVP a single active shop receives every order (FR-026).
  const shop = get<{ id: number }>("SELECT id FROM laundry_shops WHERE is_active = 1 ORDER BY id LIMIT 1");

  const insert = db.transaction(() => {
    const orderNumber = nextOrderNumber();
    const result = run(
      `INSERT INTO laundry_orders
        (order_number, customer_id, laundry_shop_id, status, pickup_address_id,
         pickup_date, pickup_time_slot, bag_count, item_count, notes)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      orderNumber,
      input.customerId,
      shop?.id ?? null,
      input.addressId,
      input.pickupDate,
      input.pickupTimeSlot,
      input.bagCount,
      input.itemCount ?? null,
      input.notes ?? null,
    );
    const id = Number(result.lastInsertRowid);
    // BR-007: every status change is recorded, including the initial one.
    run(
      "INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, 'PENDING', ?, ?)",
      id,
      actorId,
      "Pickup requested",
    );
    return id;
  });

  const order = getOrder(insert())!;
  notify("NEW_ORDER", order);
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
 * role permissions (BR-005) and history recording (BR-007).
 */
export function transitionOrder(
  orderId: number,
  to: OrderStatus,
  user: SessionUser,
  options: TransitionOptions = {},
): OrderWithDetails {
  const order = getOrder(orderId);
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

  const stamp = TIMESTAMP_COLUMN[to];
  const timestamp = now();
  const stampClause = stamp ? ", " + stamp + " = ?" : "";
  const params: unknown[] = [to, options.actualBagCount ?? null, timestamp];
  if (stamp) params.push(timestamp);
  params.push(orderId);

  db.transaction(() => {
    run(
      `UPDATE laundry_orders
       SET status = ?,
           actual_bag_count = COALESCE(?, actual_bag_count),
           updated_at = ?` +
        stampClause +
        " WHERE id = ?",
      ...params,
    );
    run(
      "INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, ?, ?, ?)",
      orderId,
      to,
      user.id,
      options.notes ?? STATUS_LABELS[to],
    );
    if (to === "PICKED_UP") {
      run("UPDATE route_orders SET status = 'COLLECTED' WHERE order_id = ?", orderId);
    }
  })();

  const updated = getOrder(orderId)!;
  const event = EVENT_FOR_STATUS[to];
  if (event) notify(event, updated);
  return updated;
}

/** FR-007: only an administrator assigns a pickup agent (BR-003). */
export function assignPickupAgent(orderId: number, agentId: number, admin: SessionUser): OrderWithDetails {
  const order = getOrder(orderId);
  if (!order) throw notFound();
  if (order.status !== "PENDING" && order.status !== "PICKUP_ASSIGNED") {
    throw conflict("This order is already past the pickup stage.");
  }
  assertActiveAgent(agentId);

  run("UPDATE laundry_orders SET pickup_agent_id = ?, updated_at = ? WHERE id = ?", agentId, now(), orderId);
  if (order.status === "PENDING") {
    return transitionOrder(orderId, "PICKUP_ASSIGNED", admin, { notes: "Pickup agent assigned" });
  }
  const updated = getOrder(orderId)!;
  notify("AGENT_ASSIGNED", updated);
  return updated;
}

/** FR-016: assigns a delivery agent, moving READY -> OUT_FOR_DELIVERY. */
export function assignDeliveryAgent(orderId: number, agentId: number, admin: SessionUser): OrderWithDetails {
  const order = getOrder(orderId);
  if (!order) throw notFound();
  if (order.status !== "READY" && order.status !== "OUT_FOR_DELIVERY") {
    throw conflict("Only a ready order can be assigned for delivery.");
  }
  assertActiveAgent(agentId);

  run("UPDATE laundry_orders SET delivery_agent_id = ?, updated_at = ? WHERE id = ?", agentId, now(), orderId);
  if (order.status === "READY") {
    return transitionOrder(orderId, "OUT_FOR_DELIVERY", admin, { notes: "Delivery agent assigned" });
  }
  const updated = getOrder(orderId)!;
  notify("DELIVERY_ASSIGNED", updated);
  return updated;
}

function assertActiveAgent(agentId: number): void {
  const agent = get<{ id: number }>(
    "SELECT id FROM users WHERE id = ? AND role = 'PICKUP_AGENT' AND is_active = 1",
    agentId,
  );
  if (!agent) throw badRequest(ERRORS.agentUnavailable);
}

/** FR-014 / BR-010: shop staff and administrators set the final price. */
export function setPrice(orderId: number, price: number, user: SessionUser): OrderWithDetails {
  const order = getOrder(orderId);
  if (!order) throw notFound();
  if (user.role !== "SHOP_STAFF" && user.role !== "ADMIN") throw forbidden();
  assertCanView(user, order);
  if (!Number.isFinite(price) || price < 0) throw badRequest("Please enter a valid price.");
  if (order.status === "DELIVERED" && user.role !== "ADMIN") {
    throw conflict("This order is already completed.");
  }

  run("UPDATE laundry_orders SET price = ?, updated_at = ? WHERE id = ?", price, now(), orderId);
  run(
    "INSERT INTO order_status_history (order_id, status, changed_by, notes) VALUES (?, ?, ?, ?)",
    orderId,
    order.status,
    user.id,
    "Price set to LKR " + price.toLocaleString("en-LK"),
  );
  return getOrder(orderId)!;
}

/** Customers may cancel only before the laundry has been collected. */
export function cancelOrder(orderId: number, user: SessionUser, reason?: string): OrderWithDetails {
  const order = getOrder(orderId);
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
export function statusCounts(pickupDate?: string): Record<string, number> {
  const rows = pickupDate
    ? all<{ status: string; c: number }>(
        "SELECT status, COUNT(*) AS c FROM laundry_orders WHERE pickup_date = ? GROUP BY status",
        pickupDate,
      )
    : all<{ status: string; c: number }>("SELECT status, COUNT(*) AS c FROM laundry_orders GROUP BY status");

  const counts: Record<string, number> = { CANCELLED: 0 };
  for (const status of ORDER_STATUSES) counts[status] = 0;
  for (const row of rows) counts[row.status] = row.c;
  return counts;
}
