import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { phoneToAuthEmail } from "./supabase/env";
import { badRequest, conflict, notFound } from "./errors";
import { normalisePhone } from "./validation";
import type { Address, LaundryShop, PickupRoute, Role, RouteOrder, User } from "./types";

/**
 * Users, addresses, shops, routes and settings.
 *
 * Row level security does the real enforcement: each call runs as the
 * signed-in person, so a query that asks for more than it should comes back
 * empty rather than leaking. The role checks in the route handlers are the
 * second lock, not the only one.
 */

/** PostgREST reads or=(...) as a comma-separated list, so quote the value. */
function quoted(term: string): string {
  return `"%${term.replace(/["\\]/g, "")}%"`;
}

// --- Users -------------------------------------------------------------------

export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("phone", normalisePhone(phone))
    .maybeSingle();
  return (data as User | null) ?? undefined;
}

export async function getUser(id: number): Promise<User | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  return (data as User | null) ?? undefined;
}

export async function listUsers(role: Role, search?: string): Promise<User[]> {
  const supabase = await supabaseServer();
  let query = supabase.from("users").select("*").eq("role", role);
  if (search) {
    const t = quoted(search);
    query = query.or(`name.ilike.${t},phone.ilike.${t}`);
  }
  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data ?? []) as User[];
}

export interface NewUser {
  name: string;
  phone: string;
  email?: string | null;
  password: string;
  role: Role;
  shopId?: number | null;
}

/**
 * FR-025: an administrator creates an agent or shop staff account.
 *
 * Two steps on purpose. The auth account comes first and the trigger gives it
 * a CUSTOMER row; the role is then set in a separate write that only the
 * service role can make. Signup metadata is client-controlled, so it can never
 * be allowed to name a role.
 */
export async function createUser(input: NewUser): Promise<User> {
  const phone = normalisePhone(input.phone);
  if (await findUserByPhone(phone)) {
    throw conflict("An account with this mobile number already exists.");
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: phoneToAuthEmail(phone),
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, phone, contact_email: input.email || "" },
  });

  if (error || !data.user) {
    throw badRequest(error?.message ?? "That account could not be created.");
  }

  // The trigger made a CUSTOMER row, because signup metadata cannot be trusted
  // with a role. Promoting it is a separate write that only the service role
  // can make, which is what makes the role safe.
  const { data: promoted, error: promoteError } = await admin
    .from("users")
    .update({ role: input.role, shop_id: input.shopId ?? null })
    .eq("auth_id", data.user.id)
    .select("*")
    .single();

  if (promoteError) {
    // Leave no half-made account behind.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw badRequest(promoteError.message);
  }
  return promoted as User;
}

export interface UserUpdate {
  name?: string;
  phone?: string;
  email?: string | null;
  password?: string;
  is_active?: boolean;
  shop_id?: number | null;
}

export async function updateUser(id: number, patch: UserUpdate): Promise<User> {
  const supabase = await supabaseServer();
  const user = await getUser(id);
  if (!user) throw notFound();

  if (patch.phone) {
    const phone = normalisePhone(patch.phone);
    const clash = await findUserByPhone(phone);
    if (clash && clash.id !== id) throw conflict("That mobile number is already registered.");
  }

  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.phone !== undefined) fields.phone = normalisePhone(patch.phone);
  if (patch.email !== undefined) fields.email = patch.email || null;
  if (patch.is_active !== undefined) fields.is_active = patch.is_active;
  if (patch.shop_id !== undefined) fields.shop_id = patch.shop_id;

  if (Object.keys(fields).length) {
    fields.updated_at = new Date().toISOString();
    const { error } = await supabase.from("users").update(fields).eq("id", id);
    if (error) throw error;
  }

  // The password and the sign-in address live in auth, not in this table.
  if (patch.password || patch.phone) {
    if (!user.auth_id) throw badRequest("That account has no sign-in yet.");
    const admin = supabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(user.auth_id, {
      ...(patch.password ? { password: patch.password } : {}),
      ...(patch.phone ? { email: phoneToAuthEmail(normalisePhone(patch.phone)) } : {}),
    });
    if (error) throw badRequest(error.message);
  }

  // Deactivating an account must also end its active sessions.
  if (patch.is_active === false && user.auth_id) {
    await supabaseAdmin().auth.admin.signOut(user.auth_id, "global").catch(() => {});
  }

  return (await getUser(id))!;
}

/**
 * FR-003: the signed-in person changes their own password. Supabase has no
 * "verify this password" call, so the current one is checked by signing in
 * with it on a throwaway client that never touches the cookie jar.
 */
export async function changePassword(
  id: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await getUser(id);
  if (!user) throw notFound();

  const { createClient } = await import("@supabase/supabase-js");
  const { SUPABASE_ANON_KEY, SUPABASE_URL } = await import("./supabase/env");
  const probe = createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: wrong } = await probe.auth.signInWithPassword({
    email: phoneToAuthEmail(user.phone),
    password: currentPassword,
  });
  if (wrong) throw badRequest("Your current password is incorrect.");

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw badRequest(error.message);
}

/** FR-025: how much work each agent is currently carrying. */
export interface AgentWorkload extends User {
  active_pickups: number;
  active_deliveries: number;
  completed: number;
}

export async function listAgentsWithWorkload(): Promise<AgentWorkload[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("agent_workload")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as AgentWorkload[];
}

/** FR-024: customers with their order totals. */
export interface CustomerSummary extends User {
  order_count: number;
  total_spend: number | null;
  last_order_at: string | null;
}

export async function listCustomers(search?: string): Promise<CustomerSummary[]> {
  const supabase = await supabaseServer();
  let query = supabase.from("customer_summary").select("*");
  if (search) {
    const t = quoted(search);
    query = query.or(`name.ilike.${t},phone.ilike.${t}`);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomerSummary[];
}

// --- Addresses (FR-004) ------------------------------------------------------

export async function listAddresses(userId: number): Promise<Address[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("id");
  if (error) throw error;
  return (data ?? []) as Address[];
}

export async function getAddress(id: number, userId: number): Promise<Address | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle();
  return (data as Address | null) ?? undefined;
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

export async function createAddress(userId: number, input: AddressInput): Promise<Address> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label,
      address: input.address,
      area: input.area || null,
      landmark: input.landmark || null,
      phone: input.phone || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Address;
}

export async function updateAddress(
  id: number,
  userId: number,
  input: AddressInput,
): Promise<Address> {
  const supabase = await supabaseServer();
  if (!(await getAddress(id, userId))) throw notFound();
  const { data, error } = await supabase
    .from("addresses")
    .update({
      label: input.label,
      address: input.address,
      area: input.area || null,
      landmark: input.landmark || null,
      phone: input.phone || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Address;
}

/**
 * Addresses are soft-deleted: existing orders keep a foreign key to them, so the
 * row must stay while disappearing from the customer's address book.
 */
export async function deleteAddress(id: number, userId: number): Promise<void> {
  const supabase = await supabaseServer();
  if (!(await getAddress(id, userId))) throw notFound();
  const { error } = await supabase
    .from("addresses")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// --- Laundry shops (FR-026) --------------------------------------------------

export async function listShops(activeOnly = false): Promise<LaundryShop[]> {
  const supabase = await supabaseServer();
  const query = supabase.from("laundry_shops").select("*");
  const { data, error } = activeOnly
    ? await query.eq("is_active", true).order("name")
    : await query.order("is_active", { ascending: false }).order("name");
  if (error) throw error;
  return (data ?? []) as LaundryShop[];
}

export async function getShop(id: number): Promise<LaundryShop | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("laundry_shops").select("*").eq("id", id).maybeSingle();
  return (data as LaundryShop | null) ?? undefined;
}

export interface ShopInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
}

export async function createShop(input: ShopInput): Promise<LaundryShop> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("laundry_shops")
    .insert({
      name: input.name,
      phone: input.phone || null,
      address: input.address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_active: input.is_active !== false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as LaundryShop;
}

export async function updateShop(id: number, input: ShopInput): Promise<LaundryShop> {
  const supabase = await supabaseServer();
  if (!(await getShop(id))) throw notFound();
  const { data, error } = await supabase
    .from("laundry_shops")
    .update({
      name: input.name,
      phone: input.phone || null,
      address: input.address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_active: input.is_active !== false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as LaundryShop;
}

// --- Pickup routes (FR-022) --------------------------------------------------

export async function listRoutes(agentId?: number, routeDate?: string): Promise<PickupRoute[]> {
  const supabase = await supabaseServer();
  let query = supabase.from("route_summary").select("*");
  if (agentId) query = query.eq("agent_id", agentId);
  if (routeDate) query = query.eq("route_date", routeDate);
  const { data, error } = await query
    .order("route_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PickupRoute[];
}

export async function getRoute(id: number): Promise<PickupRoute | undefined> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("route_summary").select("*").eq("id", id).maybeSingle();
  return (data as PickupRoute | null) ?? undefined;
}

type RouteStopRow = {
  id: number;
  route_id: number;
  order_id: number;
  sequence: number;
  status: string;
  order: {
    order_number: string;
    bag_count: number;
    status: string;
    customer: { name: string } | null;
    address: { address: string } | null;
  } | null;
};

export async function getRouteOrders(routeId: number): Promise<RouteOrder[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("route_orders")
    .select(
      `id, route_id, order_id, sequence, status,
       order:laundry_orders!route_orders_order_id_fkey (
         order_number, bag_count, status,
         customer:users!laundry_orders_customer_id_fkey ( name ),
         address:addresses!laundry_orders_pickup_address_id_fkey ( address )
       )`,
    )
    .eq("route_id", routeId)
    .order("sequence");
  if (error) throw error;

  return ((data ?? []) as unknown as RouteStopRow[]).map((row) => ({
    id: row.id,
    route_id: row.route_id,
    order_id: row.order_id,
    sequence: row.sequence,
    status: row.status,
    order_number: row.order?.order_number ?? "",
    bag_count: row.order?.bag_count ?? 0,
    order_status: (row.order?.status ?? "PENDING") as RouteOrder["order_status"],
    customer_name: row.order?.customer?.name ?? "",
    address_line: row.order?.address?.address ?? "",
  })) as RouteOrder[];
}

/**
 * FR-022: groups pending orders into one route for an agent. The route and its
 * stops are written by create_route() so they land together; each order then
 * gets the agent assigned through the order service, which is what produces
 * the status history row and the notification.
 */
export async function createRoute(
  input: { name?: string | null; agentId: number; routeDate: string; orderIds: number[] },
  assign: (orderId: number, agentId: number) => Promise<void>,
): Promise<PickupRoute> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_route", {
    p_agent_id: input.agentId,
    p_route_date: input.routeDate,
    p_order_ids: input.orderIds,
    p_name: input.name || null,
  });
  if (error) {
    if (error.message.includes("AGENT_UNAVAILABLE")) {
      throw badRequest("No pickup agent is currently available.");
    }
    throw error;
  }

  // Sequential, because the selection order is the order the agent drives.
  for (const orderId of input.orderIds) await assign(orderId, input.agentId);
  return (await getRoute(Number(data)))!;
}

export async function updateRouteStatus(
  id: number,
  status: PickupRoute["status"],
): Promise<PickupRoute> {
  const supabase = await supabaseServer();
  if (!(await getRoute(id))) throw notFound();
  const { error } = await supabase
    .from("pickup_routes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return (await getRoute(id))!;
}

export async function deleteRoute(id: number): Promise<void> {
  const supabase = await supabaseServer();
  if (!(await getRoute(id))) throw notFound();
  const { error } = await supabase.from("pickup_routes").delete().eq("id", id);
  if (error) throw error;
}

// --- Settings ----------------------------------------------------------------

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

export async function allSettings(): Promise<Record<string, string>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}
