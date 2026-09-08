/**
 * Row level security, tested with the app taken out of the way.
 *
 * The acceptance run proves the screens behave. This one proves the database
 * does: it talks straight to PostgREST with the anon key - the same key that
 * ships to the browser - as a signed-in customer, and tries the things a
 * curious person with the developer console would try.
 *
 *   npm run test:rls
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) pass += 1;
  else {
    fail += 1;
    failures.push(`${name}${detail ? " -> " + detail : ""}`);
  }
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${ok || !detail ? "" : "  (" + detail + ")"}`);
}

function anon() {
  return createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signedInAs(phone) {
  const client = anon();
  const { error } = await client.auth.signInWithPassword({
    email: `${phone}@quickwash.local`,
    password: "password123",
  });
  if (error) throw new Error(`sign in ${phone}: ${error.message}`);
  return client;
}

const main = async () => {
  const ahmed = await signedInAs("0771111111"); // customer
  const fathima = await signedInAs("0772222222"); // another customer
  const kamal = await signedInAs("0770000003"); // pickup agent
  const admin = SERVICE
    ? createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  console.log("\n--- What a signed-out visitor can reach ---");
  const stranger = anon();
  for (const table of ["users", "laundry_orders", "addresses", "notifications", "settings"]) {
    const { data } = await stranger.from(table).select("*").limit(1);
    check(`anonymous read of ${table} returns nothing`, (data ?? []).length === 0);
  }

  console.log("\n--- BR-008: a customer sees only their own orders ---");
  const { data: mine } = await ahmed.from("laundry_orders").select("id, customer_id");
  const { data: me } = await ahmed.from("users").select("id").eq("phone", "0771111111").single();
  check("Ahmed sees some orders", (mine ?? []).length > 0, `${mine?.length ?? 0}`);
  check(
    "every order Ahmed sees is his own",
    (mine ?? []).every((o) => o.customer_id === me.id),
    `${(mine ?? []).filter((o) => o.customer_id !== me.id).length} foreign rows`,
  );

  const { data: hers } = await fathima.from("laundry_orders").select("id");
  const hersIds = new Set((hers ?? []).map((o) => o.id));
  const overlap = (mine ?? []).filter((o) => hersIds.has(o.id));
  check("Ahmed and Fathima see disjoint orders", overlap.length === 0, `${overlap.length} shared`);

  const theirOrder = (hers ?? [])[0]?.id;
  const { data: peek } = await ahmed.from("laundry_orders").select("*").eq("id", theirOrder);
  check("asking for another customer's order by id returns nothing", (peek ?? []).length === 0);

  console.log("\n--- The status trail follows the order ---");
  const { data: trail } = await ahmed
    .from("order_status_history")
    .select("order_id")
    .eq("order_id", theirOrder);
  check("history of an order you cannot see is empty", (trail ?? []).length === 0);

  console.log("\n--- Notifications are yours alone ---");
  const { data: notes } = await ahmed.from("notifications").select("user_id");
  check("Ahmed has notifications", (notes ?? []).length > 0, `${notes?.length ?? 0}`);
  check(
    "all of them are addressed to him",
    (notes ?? []).every((n) => n.user_id === me.id),
  );

  const { data: fathimaRow } = await admin
    ? await admin.from("users").select("id").eq("phone", "0772222222").single()
    : { data: null };
  if (fathimaRow) {
    const { error } = await ahmed.from("notifications").insert({
      user_id: fathimaRow.id,
      event: "NEW_ORDER",
      title: "Injected",
      body: "This should never land.",
    });
    check("a customer cannot write a notification for someone else", Boolean(error), error?.code);
  }

  console.log("\n--- Nobody promotes themselves ---");
  const { error: promote } = await ahmed.from("users").update({ role: "ADMIN" }).eq("id", me.id);
  const { data: after } = await ahmed.from("users").select("role").eq("id", me.id).single();
  check(
    "a customer cannot make themselves an administrator",
    after?.role === "CUSTOMER",
    `role is now ${after?.role}${promote ? " (rejected: " + promote.code + ")" : ""}`,
  );

  console.log("\n--- The order counter is unreachable ---");
  const { data: counters } = await ahmed.from("order_counters").select("*");
  check("order_counters is not readable at all", (counters ?? []).length === 0);

  console.log("\n--- The state machine holds without the app (BR-005, BR-006) ---");
  const myOrder = (mine ?? [])[0]?.id;
  const { error: jump } = await ahmed.rpc("transition_order", {
    p_order_id: myOrder,
    p_to: "DELIVERED",
    p_notes: "straight to the end",
  });
  check("a customer cannot skip an order to DELIVERED", Boolean(jump), jump?.message?.slice(0, 60));

  const { error: theirs } = await kamal.rpc("transition_order", {
    p_order_id: theirOrder,
    p_to: "PICKED_UP",
    p_notes: "not my job",
  });
  check("an agent cannot collect an order not assigned to them", Boolean(theirs), theirs?.message?.slice(0, 60));

  const { error: priced } = await ahmed.rpc("set_order_price", {
    p_order_id: myOrder,
    p_price: 1,
  });
  check("a customer cannot set their own price", Boolean(priced), priced?.message?.slice(0, 60));

  const { error: routed } = await ahmed.rpc("create_route", {
    p_agent_id: 1,
    p_route_date: new Date().toISOString().slice(0, 10),
    p_order_ids: [myOrder],
    p_name: "mine now",
  });
  check("a customer cannot plan a route", Boolean(routed), routed?.message?.slice(0, 60));

  console.log("\n--- Orders cannot be written around the functions ---");
  const { error: direct } = await ahmed
    .from("laundry_orders")
    .update({ status: "DELIVERED" })
    .eq("id", myOrder);
  const { data: still } = await ahmed.from("laundry_orders").select("status").eq("id", myOrder).single();
  check(
    "a customer cannot UPDATE an order row directly",
    still?.status !== "DELIVERED",
    `status is ${still?.status}${direct ? " (rejected)" : " (silently no-op)"}`,
  );

  const { error: forged } = await ahmed.from("order_status_history").insert({
    order_id: myOrder,
    status: "DELIVERED",
    notes: "forged",
  });
  check("a customer cannot forge a history row", Boolean(forged), forged?.code);

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
