/**
 * Seeds the SQLite database with a laundry shop, staff, agents and a set of
 * customers whose orders sit at every stage of the pipeline, so each dashboard
 * has something to show on first run.
 *
 *   npm run db:seed
 */
import { db, run, today } from "../src/lib/db";
import { createOrder, transitionOrder, assignPickupAgent, assignDeliveryAgent, setPrice } from "../src/lib/orders";
import { createAddress, createShop, createUser, setSetting } from "../src/lib/repos";
import type { OrderStatus, SessionUser } from "../src/lib/types";

const PASSWORD = "password123";

function asSession(user: { id: number; name: string; phone: string; email: string | null; role: string; shop_id: number | null }): SessionUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    shop_id: user.shop_id,
  };
}

function wipe() {
  // Order matters only for readability; foreign keys cascade from the parents.
  for (const table of [
    "route_orders",
    "pickup_routes",
    "notifications",
    "order_status_history",
    "laundry_orders",
    "addresses",
    "sessions",
    "users",
    "laundry_shops",
    "order_counters",
    "settings",
  ]) {
    run("DELETE FROM " + table);
  }
  run("DELETE FROM sqlite_sequence");
}

function dateOffset(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000 - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
}

function main() {
  console.log("Seeding QuickWash database...");
  db.pragma("foreign_keys = OFF");
  wipe();
  db.pragma("foreign_keys = ON");

  const shop = createShop({
    name: "Puttalam Central Laundry",
    phone: "0322265100",
    address: "No. 12, Kurunegala Road, Puttalam",
    latitude: 8.0362,
    longitude: 79.8283,
  });

  const admin = createUser({
    name: "System Administrator",
    phone: "0770000001",
    email: "admin@puttalamlaundry.lk",
    password: PASSWORD,
    role: "ADMIN",
  });

  const staff = createUser({
    name: "Nuwan Perera",
    phone: "0770000002",
    email: "shop@puttalamlaundry.lk",
    password: PASSWORD,
    role: "SHOP_STAFF",
    shopId: shop.id,
  });

  const kamal = createUser({
    name: "Kamal Silva",
    phone: "0770000003",
    password: PASSWORD,
    role: "PICKUP_AGENT",
  });

  const rizwan = createUser({
    name: "Rizwan Mohamed",
    phone: "0770000004",
    password: PASSWORD,
    role: "PICKUP_AGENT",
  });

  const adminSession = asSession(admin);
  const staffSession = asSession(staff);
  const kamalSession = asSession(kamal);
  const rizwanSession = asSession(rizwan);

  const customerSeeds = [
    { name: "Ahmed Nazeer", phone: "0771111111", area: "Puttalam Town", address: "No. 25, Main Street, Puttalam", landmark: "Near Zahira College" },
    { name: "Fathima Rizana", phone: "0772222222", area: "Puttalam Town", address: "No. 8, Beach Road, Puttalam", landmark: "Opposite the fish market" },
    { name: "Sunil Fernando", phone: "0773333333", area: "Palaviya", address: "No. 140, Colombo Road, Palaviya", landmark: "Near the petrol shed" },
    { name: "Nadeeka Jayasuriya", phone: "0774444444", area: "Anamaduwa Road", address: "No. 61, Anamaduwa Road, Puttalam", landmark: "Behind the town hall" },
    { name: "Imran Hassan", phone: "0775555555", area: "Thillayadi", address: "No. 3, Lagoon View, Thillayadi", landmark: "Near the jetty" },
  ];

  const customers = customerSeeds.map((seed) => {
    const user = createUser({
      name: seed.name,
      phone: seed.phone,
      password: PASSWORD,
      role: "CUSTOMER",
    });
    const address = createAddress(user.id, {
      label: "Home",
      address: seed.address,
      area: seed.area,
      landmark: seed.landmark,
      phone: seed.phone,
    });
    return { user, address, session: asSession(user) };
  });

  // Each entry drives one order up to the given status, so every dashboard has
  // work waiting on it.
  const plan: Array<{ customer: number; bags: number; items: number; upTo: OrderStatus; date: string; slot: string; price?: number; notes?: string }> = [
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

  // The pipeline order each plan entry walks through.
  const pipeline: OrderStatus[] = [
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

  let created = 0;
  for (const [index, entry] of plan.entries()) {
    const customer = customers[entry.customer];
    const agent = index % 2 === 0 ? kamal : rizwan;
    const agentSession = index % 2 === 0 ? kamalSession : rizwanSession;

    const order = createOrder(
      {
        customerId: customer.user.id,
        addressId: customer.address.id,
        pickupDate: entry.date,
        pickupTimeSlot: entry.slot,
        bagCount: entry.bags,
        itemCount: entry.items,
        notes: entry.notes ?? null,
        allowPastDate: true,
      },
      customer.user.id,
    );
    created += 1;

    const target = pipeline.indexOf(entry.upTo);
    for (let step = 0; step <= target; step += 1) {
      const status = pipeline[step];
      if (status === "PICKUP_ASSIGNED") {
        assignPickupAgent(order.id, agent.id, adminSession);
      } else if (status === "OUT_FOR_DELIVERY") {
        assignDeliveryAgent(order.id, agent.id, adminSession);
      } else if (status === "PICKED_UP") {
        transitionOrder(order.id, "PICKED_UP", agentSession, { actualBagCount: entry.bags });
      } else if (status === "DELIVERED") {
        transitionOrder(order.id, "DELIVERED", agentSession, { notes: "Handed over to the customer" });
      } else {
        transitionOrder(order.id, status, staffSession);
      }
      // The price is set once the shop knows the real item count.
      if (status === "WASHING" && entry.price) setPrice(order.id, entry.price, staffSession);
    }
  }

  setSetting("business_name", "QuickWash");
  setSetting("service_area", "Puttalam");
  setSetting("contact_phone", "0322265100");
  setSetting("price_per_bag", "600");
  setSetting("currency", "LKR");

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

main();
