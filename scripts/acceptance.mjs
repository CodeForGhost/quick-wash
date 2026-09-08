/**
 * QuickWash-on-Postgres acceptance run: the SRS section 20 loop, the negative
 * access checks, and the four things the migration could silently break.
 */
const BASE = process.argv[2] ?? "http://localhost:3021";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`${name}${detail ? " -> " + detail : ""}`);
  }
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${ok || !detail ? "" : "  (" + detail + ")"}`);
}

/** One cookie jar per actor. Supabase splits its auth token across several. */
const jars = new Map();

function jarFor(who) {
  if (!jars.has(who)) jars.set(who, new Map());
  return jars.get(who);
}

async function call(who, path, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  const jar = jarFor(who);
  if (jar.size) {
    headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair, ...attrs] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = attrs.some((a) => /max-age=0|expires=Thu, 01 Jan 1970/i.test(a));
    if (expired || value === "") jar.delete(name);
    else jar.set(name, value);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON (a redirect or an HTML page) */
  }
  return { status: res.status, body };
}

async function login(who, phone) {
  const r = await call(who, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password: "password123" }),
  });
  check(`sign in as ${who}`, r.status === 200, `status ${r.status}`);
}

const main = async () => {
  console.log("\n--- Sign-in ---");
  await login("admin", "0770000001");
  await login("shop", "0770000002");
  await login("agent", "0770000003");
  await login("customer", "0771111111");
  await login("other", "0772222222");

  console.log("\n--- Registration and a fresh order (FR-001..FR-006) ---");
  const uniquePhone = "0779" + String(Date.now()).slice(-6);
  const reg = await call("new", "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Test Customer",
      phone: uniquePhone,
      password: "password123",
      address: { label: "Home", address: "No. 1, Test Lane, Puttalam", area: "Puttalam Town" },
    }),
  });
  check("register a new customer", reg.status === 201 || reg.status === 200, `status ${reg.status}`);

  const addresses = await call("new", "/api/customers/addresses");
  check("the registration created an address", addresses.body?.data?.length > 0);
  const addressId = addresses.body?.data?.[0]?.id;

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const made = await call("new", "/api/orders", {
    method: "POST",
    body: JSON.stringify({
      address_id: addressId,
      pickup_date: today,
      pickup_time_slot: "08:00 AM - 10:00 AM",
      bag_count: 2,
      item_count: 12,
      notes: "Acceptance run",
    }),
  });
  check("request a pickup", made.status === 201, `status ${made.status}`);
  const order = made.body?.data;
  check("order number is allocated", /^PU-\d{4}-\d{4}$/.test(order?.order_number ?? ""), order?.order_number);

  console.log("\n--- BR-002: the order counter is atomic ---");
  const second = await call("new", "/api/orders", {
    method: "POST",
    body: JSON.stringify({
      address_id: addressId,
      pickup_date: today,
      pickup_time_slot: "10:00 AM - 12:00 PM",
      bag_count: 1,
    }),
  });
  const a = Number(order?.order_number?.slice(-4));
  const b = Number(second.body?.data?.order_number?.slice(-4));
  check("consecutive orders take consecutive numbers", b === a + 1, `${order?.order_number} then ${second.body?.data?.order_number}`);

  // Five at once: with the old read-then-write counter these would collide.
  const burst = await Promise.all(
    [1, 2, 3, 4, 5].map(() =>
      call("new", "/api/orders", {
        method: "POST",
        body: JSON.stringify({
          address_id: addressId,
          pickup_date: today,
          pickup_time_slot: "02:00 PM - 04:00 PM",
          bag_count: 1,
        }),
      }),
    ),
  );
  const numbers = burst.map((r) => r.body?.data?.order_number).filter(Boolean);
  check("five concurrent orders all succeed", numbers.length === 5, `${numbers.length}/5`);
  check("five concurrent orders take five distinct numbers", new Set(numbers).size === 5, numbers.join(" "));

  console.log("\n--- The pipeline, end to end (SRS section 9) ---");
  const id = order.id;
  const agents = await call("admin", "/api/admin/agents");
  const agentId = agents.body?.data?.find((x) => x.is_active)?.id;
  check("agent list returns an active agent", Boolean(agentId));

  let r = await call("admin", `/api/admin/orders/${id}/assign-agent`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
  check("admin assigns a pickup agent", r.status === 200 && r.body?.data?.status === "PICKUP_ASSIGNED", r.body?.error);

  // The seeded agent 0770000003 may not be the one assigned; sign in as them.
  const assignedPhone = agents.body.data.find((x) => x.id === agentId).phone;
  await login("assigned", assignedPhone);

  r = await call("assigned", `/api/agent/orders/${id}/pickup`, {
    method: "POST",
    body: JSON.stringify({ actual_bag_count: 2 }),
  });
  check("agent collects the laundry", r.status === 200 && r.body?.data?.status === "PICKED_UP", r.body?.error);

  for (const status of ["AT_LAUNDRY", "WASHING", "DRYING", "IRONING", "READY"]) {
    r = await call("shop", `/api/shop/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    check(`shop moves it to ${status}`, r.status === 200 && r.body?.data?.status === status, r.body?.error);
  }

  console.log("\n--- Money is numeric, not a float (FR-014) ---");
  r = await call("shop", `/api/shop/orders/${id}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price: 1234.56 }),
  });
  check("shop sets the price", r.status === 200, r.body?.error);
  check("price round-trips exactly as a number", r.body?.data?.price === 1234.56, JSON.stringify(r.body?.data?.price) + " (" + typeof r.body?.data?.price + ")");

  r = await call("admin", `/api/admin/orders/${id}/assign-agent`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, type: "delivery" }),
  });
  const outForDelivery = r.status === 200 && r.body?.data?.status === "OUT_FOR_DELIVERY";
  check("admin assigns delivery", outForDelivery, r.body?.error ?? r.body?.data?.status);

  r = await call("assigned", `/api/agent/orders/${id}/deliver`, { method: "POST", body: JSON.stringify({}) });
  check("agent delivers", r.status === 200 && r.body?.data?.status === "DELIVERED", r.body?.error);

  console.log("\n--- Timestamps come back as strings, not Date objects (BR-007) ---");
  const history = await call("new", `/api/orders/${id}/status-history`);
  const trail = history.body?.data ?? [];
  check("the status trail is complete", trail.length >= 9, `${trail.length} rows`);
  check("history timestamps parse to a real instant",
    trail.every((h) => typeof h.created_at === "string" && !Number.isNaN(Date.parse(h.created_at))),
    JSON.stringify(trail[0]?.created_at));
  check("the first history row is PENDING", trail[0]?.status === "PENDING", trail[0]?.status);
  check("pickup_date is a plain YYYY-MM-DD string",
    typeof order.pickup_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(order.pickup_date),
    JSON.stringify(order.pickup_date));

  console.log("\n--- Search is still case-insensitive (ILIKE, not LIKE) ---");
  const lower = await call("admin", "/api/admin/orders?q=ahmed");
  const upper = await call("admin", "/api/admin/orders?q=AHMED");
  check("lowercase search finds 'Ahmed Nazeer'", (lower.body?.data?.orders?.length ?? 0) > 0, `${lower.body?.data?.orders?.length} results`);
  check("search is case-insensitive", (lower.body?.data?.orders?.length ?? 0) === (upper.body?.data?.orders?.length ?? 0),
    `${lower.body?.data?.orders?.length} vs ${upper.body?.data?.orders?.length}`);

  console.log("\n--- Booleans (is_active / is_deleted / is_read) ---");
  const shops = await call("admin", "/api/admin/shops");
  check("shop list is not empty", (shops.body?.data?.length ?? 0) > 0);
  check("is_active is a real boolean", typeof shops.body?.data?.[0]?.is_active === "boolean",
    typeof shops.body?.data?.[0]?.is_active);

  const notifs = await call("customer", "/api/notifications");
  check("notifications are returned", (notifs.body?.data?.notifications?.length ?? notifs.body?.data?.length ?? 0) > 0);

  const addrList = await call("new", "/api/customers/addresses");
  const toDelete = addrList.body?.data?.[0]?.id;
  const created = await call("new", "/api/customers/addresses", {
    method: "POST",
    body: JSON.stringify({ label: "Work", address: "No. 9, Second Lane", area: "Palaviya" }),
  });
  check("a second address can be added", created.status === 201 || created.status === 200, `status ${created.status}`);
  const del = await call("new", `/api/customers/addresses/${toDelete}`, { method: "DELETE" });
  check("an address soft-deletes", del.status === 200, `status ${del.status}`);
  const after = await call("new", "/api/customers/addresses");
  check("the soft-deleted address is hidden", !after.body?.data?.some((x) => x.id === toDelete));

  console.log("\n--- Access control (BR-004, BR-008, SRS section 12) ---");
  // Row level security hides the row rather than refusing it, so this is a
  // 404 where the SQLite build returned 403. That leaks less: a stranger
  // cannot even learn the order exists.
  r = await call("other", `/api/orders/${id}`);
  check("another customer cannot read the order", r.status === 404 || r.status === 403, `status ${r.status}`);
  r = await call("customer", `/api/admin/orders/${id}/assign-agent`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
  check("a customer cannot assign an agent (403)", r.status === 403, `status ${r.status}`);
  r = await call("agent", `/api/shop/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "WASHING" }),
  });
  check("an agent cannot set shop status (403)", r.status === 403, `status ${r.status}`);
  r = await call("customer", `/api/shop/orders/${id}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price: 1 }),
  });
  check("a customer cannot set the price (403)", r.status === 403, `status ${r.status}`);
  r = await call("shop", `/api/shop/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "WASHING" }),
  });
  check("a delivered order cannot move backwards (409)", r.status === 409, `status ${r.status}`);
  r = await call("nobody", `/api/orders/${id}`);
  check("an unauthenticated request is rejected (401)", r.status === 401, `status ${r.status}`);

  console.log("\n--- Batch routes (FR-022) ---");
  const pending = await call("admin", "/api/admin/orders?status=PENDING");
  const orderIds = (pending.body?.data?.orders ?? []).slice(0, 3).map((o) => o.id);
  const route = await call("admin", "/api/admin/routes", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, route_date: today, name: "Acceptance round", order_ids: orderIds }),
  });
  check("a route batches several pickups", route.status === 201 || route.status === 200, route.body?.error);
  check("the route reports its stop count", route.body?.data?.order_count === orderIds.length,
    `${route.body?.data?.order_count} of ${orderIds.length}`);

  console.log("\n--- Reports and counts (FR-023) ---");
  // The owner gets their code; anyone else gets nothing at all.
  const mine = await call("new", `/api/orders/${id}/qr`);
  check("the owner can fetch the order QR code", mine.status === 200, `status ${mine.status}`);
  const theirs = await call("customer", `/api/orders/${id}/qr`);
  check("someone else cannot", theirs.status === 404 || theirs.status === 403, `status ${theirs.status}`);

  console.log("\n" + "=".repeat(56));
  console.log(`  ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\n  Failures:");
    for (const f of failures) console.log("   - " + f);
  }
  console.log("=".repeat(56) + "\n");
  process.exit(fail ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
