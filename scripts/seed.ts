/**
 * Seeds the Supabase project with a laundry shop, staff, agents and a set of
 * customers whose orders sit at every stage of the pipeline, so each dashboard
 * has something to show on first run.
 *
 *   npm run db:seed
 *
 * It does not shortcut row level security. Accounts are created with the
 * service role, because only that may set a role; everything after that is
 * done signed in as the person who would really do it, so the seed exercises
 * the same policies and functions the app does.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EVENTS, type NotificationEvent } from "../src/lib/notification-events";
import type { LaundryOrder } from "../src/lib/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing configuration. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
      "and SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local.",
  );
  process.exit(1);
}

const PASSWORD = "password123";
const DOMAIN = "quickwash.local";
const authEmail = (phone: string) => `${phone}@${DOMAIN}`;

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** A client signed in as one person, so RLS and the RPCs see a real caller. */
const clients = new Map<string, SupabaseClient>();
async function as(phone: string): Promise<SupabaseClient> {
  const cached = clients.get(phone);
  if (cached) return cached;

  const client = createClient(URL!, ANON!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: authEmail(phone),
    password: PASSWORD,
  });
  if (error) throw new Error(`could not sign in as ${phone}: ${error.message}`);
  clients.set(phone, client);
  return client;
}

interface Person {
  id: number;
  name: string;
  phone: string;
}

/** Creates the auth account and promotes the row to its real role. */
async function makeUser(input: {
  name: string;
  phone: string;
  email?: string;
  role: "CUSTOMER" | "PICKUP_AGENT" | "SHOP_STAFF" | "ADMIN";
  shopId?: number | null;
}): Promise<Person> {
  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail(input.phone),
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      phone: input.phone,
      contact_email: input.email ?? "",
    },
  });
  if (error || !data.user) throw new Error(`${input.phone}: ${error?.message}`);

  const { data: row, error: promote } = await admin
    .from("users")
    .update({ role: input.role, shop_id: input.shopId ?? null, email: input.email ?? null })
    .eq("auth_id", data.user.id)
    .select("id, name, phone")
    .single();
  if (promote) throw new Error(`${input.phone}: ${promote.message}`);
  return row as Person;
}

/**
 * The same SRS section 19 fan-out the app performs, raised by the seeder so the
 * updates screen has something on it. notify_users() is security definer, so
 * the caller only has to be signed in.
 */
async function notify(
  client: SupabaseClient,
  event: NotificationEvent,
  order: LaundryOrder,
  shopStaffIds: number[],
): Promise<void> {
  const spec = EVENTS[event];
  const ids = new Set<number>();
  for (const audience of spec.to) {
    if (audience === "customer") ids.add(order.customer_id);
    if (audience === "pickup_agent" && order.pickup_agent_id) ids.add(order.pickup_agent_id);
    if (audience === "delivery_agent" && order.delivery_agent_id) ids.add(order.delivery_agent_id);
    if (audience === "shop") for (const id of shopStaffIds) ids.add(id);
  }
  if (!ids.size) return;

  const { error } = await client.rpc("notify_users", {
    p_user_ids: [...ids],
    p_order_id: order.id,
    p_event: event,
    p_title: spec.title,
    p_body: spec.body(order),
  });
  if (error) throw new Error(`notify ${event} on order ${order.id}: ${error.message}`);
}

/** The event each status raises, from src/lib/orders.ts. */
const EVENT_FOR_STATUS: Partial<Record<Status, NotificationEvent>> = {
  PICKUP_ASSIGNED: "AGENT_ASSIGNED",
  PICKED_UP: "PICKED_UP",
  AT_LAUNDRY: "RECEIVED",
  WASHING: "PROCESSING_STARTED",
  READY: "READY",
  OUT_FOR_DELIVERY: "DELIVERY_ASSIGNED",
  DELIVERED: "DELIVERED",
};

async function wipe(): Promise<void> {
  // FK order. The service role bypasses RLS, which is the point of using it.
  for (const table of [
    "notifications",
    "order_status_history",
    "laundry_orders",
    "addresses",
    "users",
    "laundry_shops",
    "order_counters",
    "settings",
  ]) {
    const key = table === "settings" ? "key" : table === "order_counters" ? "year" : "id";
    const { error } = await admin.from(table).delete().not(key, "is", null);
    if (error) throw new Error(`clearing ${table}: ${error.message}`);
  }

  // Every demo account, so re-seeding does not collide on the email.
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.endsWith(`@${DOMAIN}`)) await admin.auth.admin.deleteUser(user.id);
  }
}

/* Puttalam's calendar day, so seeded "today" orders read as today in the app. */
const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateOffset(days: number): string {
  return DAY.format(new Date(Date.now() + days * 86_400_000));
}

const today = () => dateOffset(0);

type Status =
  | "PENDING"
  | "PICKUP_ASSIGNED"
  | "PICKED_UP"
  | "AT_LAUNDRY"
  | "WASHING"
  | "DRYING"
  | "IRONING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

async function main(): Promise<void> {
  console.log("Seeding QuickWash database...");
  await wipe();

  const { data: shopRow, error: shopError } = await admin
    .from("laundry_shops")
    .insert({
      name: "Puttalam Central Laundry",
      phone: "0322265100",
      address: "No. 12, Kurunegala Road, Puttalam",
      latitude: 8.0362,
      longitude: 79.8283,
    })
    .select("id, name")
    .single();
  if (shopError) throw shopError;
  const shop = shopRow as { id: number; name: string };

  const adminUser = await makeUser({
    name: "System Administrator",
    phone: "0770000001",
    email: "admin@quickwash.lk",
    role: "ADMIN",
  });
  const staff = await makeUser({
    name: "Nuwan Perera",
    phone: "0770000002",
    email: "shop@quickwash.lk",
    role: "SHOP_STAFF",
    shopId: shop.id,
  });
  const kamal = await makeUser({ name: "Kamal Silva", phone: "0770000003", role: "PICKUP_AGENT" });
  const rizwan = await makeUser({
    name: "Rizwan Mohamed",
    phone: "0770000004",
    role: "PICKUP_AGENT",
  });
  void adminUser;

  const customerSeeds = [
    { name: "Ahmed Nazeer", phone: "0771111111", area: "Puttalam Town", address: "No. 25, Main Street, Puttalam", landmark: "Near Zahira College" },
    { name: "Fathima Rizana", phone: "0772222222", area: "Puttalam Town", address: "No. 8, Beach Road, Puttalam", landmark: "Opposite the fish market" },
    { name: "Sunil Fernando", phone: "0773333333", area: "Palaviya", address: "No. 140, Colombo Road, Palaviya", landmark: "Near the petrol shed" },
    { name: "Nadeeka Jayasuriya", phone: "0774444444", area: "Anamaduwa Road", address: "No. 61, Anamaduwa Road, Puttalam", landmark: "Behind the town hall" },
    { name: "Imran Hassan", phone: "0775555555", area: "Thillayadi", address: "No. 3, Lagoon View, Thillayadi", landmark: "Near the jetty" },
  ];

  const customers: Array<Person & { addressId: number }> = [];
  for (const seed of customerSeeds) {
    const person = await makeUser({ name: seed.name, phone: seed.phone, role: "CUSTOMER" });
    // Signed in as the customer: RLS only lets you write your own address book.
    const client = await as(seed.phone);
    const { data, error } = await client
      .from("addresses")
      .insert({
        user_id: person.id,
        label: "Home",
        address: seed.address,
        area: seed.area,
        landmark: seed.landmark,
        phone: seed.phone,
      })
      .select("id")
      .single();
    if (error) throw new Error(`address for ${seed.phone}: ${error.message}`);
    customers.push({ ...person, addressId: (data as { id: number }).id });
  }

  // Each entry drives one order up to the given status, so every dashboard has
  // work waiting on it.
  const plan: Array<{
    customer: number;
    bags: number;
    items: number;
    upTo: Status;
    date: string;
    slot: string;
    price?: number;
    notes?: string;
  }> = [
    { customer: 0, bags: 2, items: 15, upTo: "PENDING", date: today(), slot: "08:00 AM - 10:00 AM", notes: "Please handle white clothes separately." },
    { customer: 1, bags: 1, items: 8, upTo: "PENDING", date: today(), slot: "10:00 AM - 12:00 PM" },
    { customer: 2, bags: 3, items: 22, upTo: "PICKUP_ASSIGNED", date: today(), slot: "10:00 AM - 12:00 PM" },
    { customer: 3, bags: 1, items: 6, upTo: "PICKUP_ASSIGNED", date: today(), slot: "02:00 PM - 04:00 PM", notes: "Call before arriving." },
    { customer: 4, bags: 2, items: 14, upTo: "PICKED_UP", date: today(), slot: "08:00 AM - 10:00 AM" },
    { customer: 0, bags: 1, items: 9, upTo: "AT_LAUNDRY", date: today(), slot: "08:00 AM - 10:00 AM" },
    { customer: 1, bags: 2, items: 18, upTo: "WASHING", date: dateOffset(-1), slot: "10:00 AM - 12:00 PM", price: 1450 },
    { customer: 2, bags: 1, items: 11, upTo: "IRONING", date: dateOffset(-1), slot: "12:00 PM - 02:00 PM", price: 980 },
    { customer: 3, bags: 2, items: 16, upTo: "READY", date: dateOffset(-1), slot: "04:00 PM - 06:00 PM", price: 1250 },
    { customer: 4, bags: 3, items: 25, upTo: "OUT_FOR_DELIVERY", date: dateOffset(-2), slot: "08:00 AM - 10:00 AM", price: 1900 },
    { customer: 0, bags: 2, items: 15, upTo: "DELIVERED", date: dateOffset(-4), slot: "10:00 AM - 12:00 PM", price: 1200 },
    { customer: 1, bags: 1, items: 7, upTo: "DELIVERED", date: dateOffset(-7), slot: "02:00 PM - 04:00 PM", price: 950 },
    { customer: 2, bags: 3, items: 24, upTo: "DELIVERED", date: dateOffset(-12), slot: "08:00 AM - 10:00 AM", price: 1500 },
  ];

  const pipeline: Status[] = [
    "PICKUP_ASSIGNED",
    "PICKED_UP",
    "AT_LAUNDRY",
    "WASHING",
    "DRYING",
    "IRONING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];

  const adminClient = await as("0770000001");
  const staffClient = await as(staff.phone);
  const shopStaffIds = [staff.id];

  let created = 0;
  for (const [index, entry] of plan.entries()) {
    const customer = customers[entry.customer];
    const agent = index % 2 === 0 ? kamal : rizwan;
    const agentClient = await as(agent.phone);
    const customerClient = await as(customer.phone);

    const { data: orderId, error } = await customerClient.rpc("create_order", {
      p_address_id: customer.addressId,
      p_pickup_date: entry.date,
      p_pickup_time_slot: entry.slot,
      p_bag_count: entry.bags,
      p_item_count: entry.items,
      p_notes: entry.notes ?? null,
      p_customer_id: customer.id,
    });
    if (error) throw new Error(`order for ${customer.phone}: ${error.message}`);
    const id = Number(orderId);
    created += 1;

    const load = async (): Promise<LaundryOrder> => {
      const { data } = await adminClient.from("laundry_orders").select("*").eq("id", id).single();
      return data as LaundryOrder;
    };
    await notify(customerClient, "NEW_ORDER", await load(), shopStaffIds);

    const target = pipeline.indexOf(entry.upTo);
    for (let step = 0; step <= target; step += 1) {
      const status = pipeline[step];
      const fail = (e: { message: string } | null, what: string) => {
        if (e) throw new Error(`${what} on order ${id}: ${e.message}`);
      };

      if (status === "PICKUP_ASSIGNED") {
        fail(
          (await adminClient.rpc("assign_agent", { p_order_id: id, p_agent_id: agent.id, p_delivery: false })).error,
          "assign pickup",
        );
        fail(
          (await adminClient.rpc("transition_order", { p_order_id: id, p_to: "PICKUP_ASSIGNED", p_notes: "Pickup agent assigned" })).error,
          "PICKUP_ASSIGNED",
        );
      } else if (status === "OUT_FOR_DELIVERY") {
        fail(
          (await adminClient.rpc("assign_agent", { p_order_id: id, p_agent_id: agent.id, p_delivery: true })).error,
          "assign delivery",
        );
        fail(
          (await adminClient.rpc("transition_order", { p_order_id: id, p_to: "OUT_FOR_DELIVERY", p_notes: "Delivery agent assigned" })).error,
          "OUT_FOR_DELIVERY",
        );
      } else if (status === "PICKED_UP") {
        fail(
          (await agentClient.rpc("transition_order", { p_order_id: id, p_to: "PICKED_UP", p_notes: "Collected", p_actual_bags: entry.bags })).error,
          "PICKED_UP",
        );
      } else if (status === "DELIVERED") {
        fail(
          (await agentClient.rpc("transition_order", { p_order_id: id, p_to: "DELIVERED", p_notes: "Handed over to the customer" })).error,
          "DELIVERED",
        );
      } else {
        fail(
          (await staffClient.rpc("transition_order", { p_order_id: id, p_to: status, p_notes: null })).error,
          status,
        );
      }

      const event = EVENT_FOR_STATUS[status];
      if (event) {
        const actor =
          status === "PICKED_UP" || status === "DELIVERED"
            ? agentClient
            : status === "PICKUP_ASSIGNED" || status === "OUT_FOR_DELIVERY"
              ? adminClient
              : staffClient;
        await notify(actor, event, await load(), shopStaffIds);
      }

      // The price is set once the shop knows the real item count.
      if (status === "WASHING" && entry.price) {
        fail(
          (await staffClient.rpc("set_order_price", { p_order_id: id, p_price: entry.price })).error,
          "set price",
        );
      }
    }
  }

  const settings: Array<[string, string]> = [
    ["business_name", "QuickWash"],
    ["service_area", "Puttalam"],
    ["contact_phone", "0322265100"],
    ["price_per_bag", "600"],
    ["currency", "LKR"],
  ];
  for (const [key, value] of settings) {
    const { error } = await adminClient.from("settings").upsert({ key, value }, { onConflict: "key" });
    if (error) throw new Error(`setting ${key}: ${error.message}`);
  }

  console.log("");
  console.log("  Shop:      " + shop.name);
  console.log("  Customers: " + customers.length);
  console.log("  Agents:    2  (Kamal Silva, Rizwan Mohamed)");
  console.log("  Orders:    " + created);
  console.log("");
  console.log("  Sign in with any of these (password: " + PASSWORD + ")");
  console.log("    Admin      0770000001");
  console.log("    Shop staff 0770000002");
  console.log("    Agent      0770000003");
  console.log("    Customer   0771111111");
  console.log("");
  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
