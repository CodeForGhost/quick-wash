# Supabase setup

QuickWash runs on Supabase: Postgres, Auth and row level security. There is no local
database; without the keys below nothing will load.

Sign-in is by **mobile number**, which is what the SRS asks for and what a customer in
Puttalam actually has. Supabase Auth is email-based, so each account carries a synthetic
address derived from the phone — `0771111111@quickwash.local`. Nobody sees it, nothing is
ever sent to it, and `public.users.auth_id` is the link. See "Why not email" at the end.

## 1. Create the tables

Open the Supabase **SQL Editor** and run [`schema.sql`](./schema.sql). It is safe to
re-run: it drops first. It creates

- the eight tables of SRS section 10, plus two views the dashboards need
  (`agent_workload`, `customer_summary`) — PostgREST has no `GROUP BY`
  and no correlated subquery;
- `handle_new_user` — makes a `users` row for every new signup, **always as a CUSTOMER**.
  Signup metadata is written by whoever calls `signUp()`, so it can never be allowed to
  name a role;
- `guard_user_columns` — a trigger that stops "you may edit your own profile" from
  meaning "you may edit your own role";
- the functions that do the writes which must land together, because PostgREST has no
  client-side transaction: `create_order`, `transition_order`, `set_order_price`,
  `assign_agent`, `next_order_number`, `notify_users`, `notify_order`. The four write
  functions return the order they wrote (`order_details`) rather than its id, so the app
  never reads back over the network what it has just written;
- `sync_user_claims` — keeps the caller's row id, role and shop in the access token, so a
  request costs no query to find out who is asking. Step 2b backfills existing accounts;
- `order_status_counts` and `order_status_counts_by_date`, so a dashboard counts in
  Postgres instead of pulling every order across to count in JavaScript;
- row level security on all eight tables.

## 2. Turn off email confirmation

**Authentication → Sign In / Providers → Email**, switch off "Confirm email". The
addresses are synthetic and no mail can reach them, so a confirmation step would lock
every customer out at registration.

## 2b. Put the role in the token

```bash
npm run claims:sync
```

Once, after the schema is in. This is what makes reading the session free. `getClaims()` in
`src/lib/auth.ts` verifies the token's signature locally against the project's public key,
and the `sync_user_claims` trigger keeps each account's `app_metadata` — which Supabase
puts in every token — carrying the row id, role and shop, so no query is needed either.
The script backfills the accounts that already exist; the trigger handles everyone after.
Skip it and nothing breaks — `getSessionUser()` notices the claims are missing and reads
the `users` row as it always did — but you keep paying a round trip per request for it.

The claims are stamped when a token is issued, so they go stale if a shop changes underneath
an open session. `updateUser()` ends those sessions for exactly that reason. None of this is
what enforces anything: RLS reads the live row through `my_role()`.

## 3. Point the app at the project

**Settings → API**, then:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

The first two are meant to be public — they ship to the browser, and row level security
is what protects the data, which is why step 1 matters.

The `service_role` key is different: it bypasses RLS entirely. QuickWash needs it for
exactly one thing — creating the auth account behind an agent, shop staff or admin
record, since only the service role may set a role (`createUser` in `src/lib/repos.ts`,
and the seeder). Keep it out of the browser and out of the repo.

## 4. Seed

```bash
npm run db:seed
```

A shop, an admin, two agents, five customers and thirteen orders sitting at every stage
of the pipeline, with the status trail and notifications each one would really have
raised.

The seeder does not shortcut anything. It creates the accounts with the service role,
because only that may set a role — and then **signs in as each person** and does the rest
through the same policies and functions the app uses. If RLS is wrong, the seed fails.

```bash
npm run dev
```

Sign in at `/login` with `0770000001` / `password123`, or use the one-tap demo buttons.

## Running it all locally

The whole stack runs on your machine, which is how this was built and tested:

```bash
npx supabase start -x studio,postgres-meta,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,mailpit,supavisor
```

It prints an API URL, an anon key and a service role key — put those three in
`.env.local`. Then apply the schema and seed:

```bash
docker exec -i supabase_db_laundry psql -U postgres -d postgres < supabase/schema.sql
npm run db:seed
```

`npx supabase stop` when you are done.

## Verifying

Two suites, and they check different things.

```bash
npm run build && npx next start -p 3021 &
npm run test:acceptance -- http://localhost:3021   # 47 checks, through the app
npm run test:rls                                   # 21 checks, around it
```

`test:acceptance` is the SRS section 20 loop plus the negative access checks, over real
HTTP against a built server.

`test:rls` is the one that matters more here. It talks **straight to PostgREST with the
anon key** — the same key that ships to the browser — as a signed-in customer, and tries
what a curious person with the developer console would try: read someone else's order,
forge a history row, write a notification to another user, jump an order to `DELIVERED`,
plan a route, set their own price, make themselves an administrator.

That last one is not hypothetical. The first run of this suite found it: RLS grants or
denies a whole row, so "you may edit your own profile" also meant "you may edit your own
`role`". `guard_user_columns` exists because of it.

## How the pieces map

| Concern | Where |
| --- | --- |
| Who is signed in, and their role | `src/lib/auth.ts` |
| Cookie-bound Supabase client | `src/lib/supabase/server.ts` |
| The signing keys `getClaims()` verifies against | `src/lib/supabase/jwks.ts` |
| Service-role client (staff accounts only) | `src/lib/supabase/admin.ts` |
| Orders, the state machine, notifications | `src/lib/orders.ts`, `src/lib/notifications.ts` |
| Users, addresses, shops, routes, settings | `src/lib/repos.ts` |
| Token refresh + signed-out redirect | `src/middleware.ts` |
| The rules that actually hold | `supabase/schema.sql` |

## Row level security, in words

- **Orders** — BR-008. An admin sees everything; a customer sees their own; an agent sees
  the ones assigned to them for pickup or delivery; shop staff see their shop's, plus any
  not yet routed to a shop. History follows its order.
- **Users** — you always see yourself, an admin sees everyone, and beyond that you see
  anyone named on an order you can already see. That is symmetric on purpose: the customer
  needs the agent's number as much as the agent needs theirs.
- **Addresses** — your own address book, plus the pickup address of an order you are
  collecting.
- **Notifications** — only your own, and you can only mark your own as read. You cannot
  write one at all; `notify_users` does that.
- **Orders are not writable directly** except by an admin. Every status change goes
  through `transition_order`, which re-checks the state machine and the role. `order_counters`
  has RLS on and no policy at all — it is reachable only through `next_order_number`.

The predicates are `security definer` functions (`me`, `my_role`, `my_shop`, `is_admin`,
`can_view_order`). That is deliberate: a policy that queried `users` directly would
re-enter its own policy and recurse.

## Two rules live in two places

`src/lib/orders.ts` has the transition table; `allowed_transition()` in `schema.sql` has
it again. The TypeScript copy shapes the UI — which buttons a screen offers. The SQL copy
is the one that cannot be bypassed. **Change one and change the other**; `test:rls` will
tell you if they have drifted.

The role map used to be duplicated the same way. It is not any more: `role_may_set()` in
the schema is the only copy, and `fromRpc()` in `src/lib/orders.ts` turns each raise back
into the message the screen shows. Checking it twice meant reading the order over the
network before every write purely to reject it in TypeScript first.

## Why not email

Supabase Auth has no phone + password flow without an SMS provider such as Twilio. The
choice was between paying for SMS, switching customers to email sign-in, or deriving an
email from the number. The third keeps FR-001 intact — a laundry customer here may not
have an email address at all — at the cost of one mapping function in
`src/lib/supabase/env.ts`.

If you later add a real SMS provider, `phoneToAuthEmail` is the only thing to remove.
