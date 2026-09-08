import { all, db, get, now, run } from "./db";
import { badRequest, conflict, notFound } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import { normalisePhone } from "./validation";
import type { Address, LaundryShop, PickupRoute, Role, RouteOrder, User } from "./types";

// --- Users -------------------------------------------------------------------

export function findUserByPhone(phone: string): (User & { password_hash: string }) | undefined {
  return get<User & { password_hash: string }>("SELECT * FROM users WHERE phone = ?", normalisePhone(phone));
}

export function getUser(id: number): User | undefined {
  return get<User>("SELECT * FROM users WHERE id = ?", id);
}

export function listUsers(role: Role, search?: string): User[] {
  if (search) {
    const like = "%" + search + "%";
    return all<User>(
      "SELECT * FROM users WHERE role = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY name",
      role,
      like,
      like,
    );
  }
  return all<User>("SELECT * FROM users WHERE role = ? ORDER BY name", role);
}

export interface NewUser {
  name: string;
  phone: string;
  email?: string | null;
  password: string;
  role: Role;
  shopId?: number | null;
}

export function createUser(input: NewUser): User {
  const phone = normalisePhone(input.phone);
  if (findUserByPhone(phone)) throw conflict("An account with this mobile number already exists.");

  const result = run(
    "INSERT INTO users (name, phone, email, password_hash, role, shop_id) VALUES (?, ?, ?, ?, ?, ?)",
    input.name,
    phone,
    input.email || null,
    hashPassword(input.password),
    input.role,
    input.shopId ?? null,
  );
  return getUser(Number(result.lastInsertRowid))!;
}

export interface UserUpdate {
  name?: string;
  phone?: string;
  email?: string | null;
  password?: string;
  is_active?: boolean;
  shop_id?: number | null;
}

export function updateUser(id: number, patch: UserUpdate): User {
  const user = getUser(id);
  if (!user) throw notFound();

  if (patch.phone) {
    const phone = normalisePhone(patch.phone);
    const clash = findUserByPhone(phone);
    if (clash && clash.id !== id) throw conflict("That mobile number is already registered.");
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  const push = (column: string, value: unknown) => {
    fields.push(column + " = ?");
    params.push(value);
  };

  if (patch.name !== undefined) push("name", patch.name);
  if (patch.phone !== undefined) push("phone", normalisePhone(patch.phone));
  if (patch.email !== undefined) push("email", patch.email || null);
  if (patch.password) push("password_hash", hashPassword(patch.password));
  if (patch.is_active !== undefined) push("is_active", patch.is_active ? 1 : 0);
  if (patch.shop_id !== undefined) push("shop_id", patch.shop_id);

  if (fields.length) {
    push("updated_at", now());
    params.push(id);
    run("UPDATE users SET " + fields.join(", ") + " WHERE id = ?", ...params);
  }
  // Deactivating an account must also end its active sessions.
  if (patch.is_active === false) run("DELETE FROM sessions WHERE user_id = ?", id);
  return getUser(id)!;
}

export function changePassword(id: number, currentPassword: string, newPassword: string): void {
  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", id);
  if (!row) throw notFound();
  if (!verifyPassword(currentPassword, row.password_hash)) throw badRequest("Your current password is incorrect.");
  run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", hashPassword(newPassword), now(), id);
}

/** FR-025: how much work each agent is currently carrying. */
export interface AgentWorkload extends User {
  active_pickups: number;
  active_deliveries: number;
  completed: number;
}

export function listAgentsWithWorkload(): AgentWorkload[] {
  return all<AgentWorkload>(
    `SELECT u.*,
            (SELECT COUNT(*) FROM laundry_orders o
              WHERE o.pickup_agent_id = u.id AND o.status = 'PICKUP_ASSIGNED')   AS active_pickups,
            (SELECT COUNT(*) FROM laundry_orders o
              WHERE o.delivery_agent_id = u.id AND o.status = 'OUT_FOR_DELIVERY') AS active_deliveries,
            (SELECT COUNT(*) FROM laundry_orders o
              WHERE o.delivery_agent_id = u.id AND o.status = 'DELIVERED')        AS completed
     FROM users u
     WHERE u.role = 'PICKUP_AGENT'
     ORDER BY u.is_active DESC, u.name`,
  );
}

/** FR-024: customers with their order totals. */
export interface CustomerSummary extends User {
  order_count: number;
  total_spend: number | null;
  last_order_at: string | null;
}

export function listCustomers(search?: string): CustomerSummary[] {
  const like = search ? "%" + search + "%" : null;
  const clause = like ? " AND (u.name LIKE ? OR u.phone LIKE ?)" : "";
  const params = like ? [like, like] : [];
  return all<CustomerSummary>(
    `SELECT u.*,
            (SELECT COUNT(*) FROM laundry_orders o WHERE o.customer_id = u.id) AS order_count,
            (SELECT SUM(o.price) FROM laundry_orders o
              WHERE o.customer_id = u.id AND o.status = 'DELIVERED')           AS total_spend,
            (SELECT MAX(o.created_at) FROM laundry_orders o WHERE o.customer_id = u.id) AS last_order_at
     FROM users u
     WHERE u.role = 'CUSTOMER'` +
      clause +
      " ORDER BY u.created_at DESC",
    ...params,
  );
}

// --- Addresses (FR-004) ------------------------------------------------------

export function listAddresses(userId: number): Address[] {
  return all<Address>(
    "SELECT * FROM addresses WHERE user_id = ? AND is_deleted = 0 ORDER BY id",
    userId,
  );
}

export function getAddress(id: number, userId: number): Address | undefined {
  return get<Address>("SELECT * FROM addresses WHERE id = ? AND user_id = ? AND is_deleted = 0", id, userId);
}

export interface AddressInput {
  label: string;
  address: string;
  area?: string | null;
  landmark?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function createAddress(userId: number, input: AddressInput): Address {
  const result = run(
    `INSERT INTO addresses (user_id, label, address, area, landmark, phone, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    input.label,
    input.address,
    input.area || null,
    input.landmark || null,
    input.phone || null,
    input.latitude ?? null,
    input.longitude ?? null,
  );
  return get<Address>("SELECT * FROM addresses WHERE id = ?", Number(result.lastInsertRowid))!;
}

export function updateAddress(id: number, userId: number, input: AddressInput): Address {
  const existing = getAddress(id, userId);
  if (!existing) throw notFound();
  run(
    `UPDATE addresses
     SET label = ?, address = ?, area = ?, landmark = ?, phone = ?, latitude = ?, longitude = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    input.label,
    input.address,
    input.area || null,
    input.landmark || null,
    input.phone || null,
    input.latitude ?? null,
    input.longitude ?? null,
    now(),
    id,
    userId,
  );
  return getAddress(id, userId)!;
}

/**
 * Addresses are soft-deleted: existing orders keep a foreign key to them, so the
 * row must stay while disappearing from the customer's address book.
 */
export function deleteAddress(id: number, userId: number): void {
  const existing = getAddress(id, userId);
  if (!existing) throw notFound();
  run("UPDATE addresses SET is_deleted = 1, updated_at = ? WHERE id = ? AND user_id = ?", now(), id, userId);
}

// --- Laundry shops (FR-026) --------------------------------------------------

export function listShops(activeOnly = false): LaundryShop[] {
  return activeOnly
    ? all<LaundryShop>("SELECT * FROM laundry_shops WHERE is_active = 1 ORDER BY name")
    : all<LaundryShop>("SELECT * FROM laundry_shops ORDER BY is_active DESC, name");
}

export function getShop(id: number): LaundryShop | undefined {
  return get<LaundryShop>("SELECT * FROM laundry_shops WHERE id = ?", id);
}

export interface ShopInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
}

export function createShop(input: ShopInput): LaundryShop {
  const result = run(
    "INSERT INTO laundry_shops (name, phone, address, latitude, longitude, is_active) VALUES (?, ?, ?, ?, ?, ?)",
    input.name,
    input.phone || null,
    input.address || null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.is_active === false ? 0 : 1,
  );
  return getShop(Number(result.lastInsertRowid))!;
}

export function updateShop(id: number, input: ShopInput): LaundryShop {
  if (!getShop(id)) throw notFound();
  run(
    `UPDATE laundry_shops
     SET name = ?, phone = ?, address = ?, latitude = ?, longitude = ?, is_active = ?, updated_at = ?
     WHERE id = ?`,
    input.name,
    input.phone || null,
    input.address || null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.is_active === false ? 0 : 1,
    now(),
    id,
  );
  return getShop(id)!;
}

// --- Pickup routes (FR-022) --------------------------------------------------

export function listRoutes(agentId?: number, routeDate?: string): PickupRoute[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (agentId) {
    where.push("r.agent_id = ?");
    params.push(agentId);
  }
  if (routeDate) {
    where.push("r.route_date = ?");
    params.push(routeDate);
  }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  return all<PickupRoute>(
    `SELECT r.*, u.name AS agent_name,
            (SELECT COUNT(*) FROM route_orders ro WHERE ro.route_id = r.id) AS order_count
     FROM pickup_routes r
     JOIN users u ON u.id = r.agent_id` +
      clause +
      " ORDER BY r.route_date DESC, r.id DESC",
    ...params,
  );
}

export function getRoute(id: number): PickupRoute | undefined {
  return get<PickupRoute>(
    `SELECT r.*, u.name AS agent_name,
            (SELECT COUNT(*) FROM route_orders ro WHERE ro.route_id = r.id) AS order_count
     FROM pickup_routes r
     JOIN users u ON u.id = r.agent_id
     WHERE r.id = ?`,
    id,
  );
}

export function getRouteOrders(routeId: number): RouteOrder[] {
  return all<RouteOrder>(
    `SELECT ro.*, o.order_number, o.bag_count, o.status AS order_status,
            c.name AS customer_name, a.address AS address_line
     FROM route_orders ro
     JOIN laundry_orders o ON o.id = ro.order_id
     JOIN users c          ON c.id = o.customer_id
     JOIN addresses a      ON a.id = o.pickup_address_id
     WHERE ro.route_id = ?
     ORDER BY ro.sequence`,
    routeId,
  );
}

/**
 * FR-022: groups pending orders into one route for an agent. Each order in the
 * route also gets the agent assigned, so it appears on their pickup list.
 */
export function createRoute(
  input: { name?: string | null; agentId: number; routeDate: string; orderIds: number[] },
  assign: (orderId: number, agentId: number) => void,
): PickupRoute {
  const agent = get<{ id: number }>(
    "SELECT id FROM users WHERE id = ? AND role = 'PICKUP_AGENT' AND is_active = 1",
    input.agentId,
  );
  if (!agent) throw badRequest("No pickup agent is currently available.");

  const routeId = db.transaction(() => {
    const result = run(
      "INSERT INTO pickup_routes (name, agent_id, route_date) VALUES (?, ?, ?)",
      input.name || null,
      input.agentId,
      input.routeDate,
    );
    const id = Number(result.lastInsertRowid);
    input.orderIds.forEach((orderId, index) => {
      run(
        "INSERT OR IGNORE INTO route_orders (route_id, order_id, sequence) VALUES (?, ?, ?)",
        id,
        orderId,
        index + 1,
      );
    });
    return id;
  })();

  // Assignment runs outside the insert transaction so each order also gets its
  // status history row and notification through the normal order service.
  for (const orderId of input.orderIds) assign(orderId, input.agentId);
  return getRoute(routeId)!;
}

export function updateRouteStatus(id: number, status: PickupRoute["status"]): PickupRoute {
  if (!getRoute(id)) throw notFound();
  run("UPDATE pickup_routes SET status = ?, updated_at = ? WHERE id = ?", status, now(), id);
  return getRoute(id)!;
}

export function deleteRoute(id: number): void {
  if (!getRoute(id)) throw notFound();
  run("DELETE FROM pickup_routes WHERE id = ?", id);
}

// --- Settings ----------------------------------------------------------------

export function getSetting(key: string, fallback = ""): string {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export function allSettings(): Record<string, string> {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
