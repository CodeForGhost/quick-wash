# QuickWash Pickup & Management System

An MVP implementation of [`srs-doc.md`](./srs-doc.md): customers request a laundry pickup, one
agent collects several homes on a single round, the laundry shop processes and prices the order,
and the customer follows it until it comes back clean.

Built with **Next.js 15** (App Router, TypeScript, Tailwind CSS v4), **shadcn/ui** and
**Supabase** - Postgres, Auth and row level security.

---

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the project URL and the two keys
# paste supabase/schema.sql into the Supabase SQL editor
npm run db:seed              # a shop, staff, agents, customers and orders across the pipeline
npm run dev
```

[`supabase/README.md`](./supabase/README.md) is the full setup, including how to run the whole
stack locally with `npx supabase start`.

For a production build:

```bash
npm run build
npm start
```

### Demo accounts

Every seeded account uses the password `password123`. The sign-in page also has one-tap buttons
for each of them.

| Role        | Mobile number |
| ----------- | ------------- |
| Admin       | `0770000001`  |
| Shop staff  | `0770000002`  |
| Pickup agent| `0770000003`  |
| Customer    | `0771111111`  |

`npm run db:reset` reseeds from scratch (the seed clears first, so it is idempotent). Sign-in is
by mobile number; the passwords are all `password123`.

---

## Deviation from the SRS

The SRS recommends PostgreSQL + Prisma and a separate Node backend (section 15/16). This build
uses **PostgreSQL on Supabase**, reached through `supabase-js`, and runs the API as Next.js route
handlers rather than a separate service. [`supabase/schema.sql`](./supabase/schema.sql) is a
direct translation of SRS section 10.

Authentication uses **mobile number + password**, as FR-001 asks. Supabase Auth is email-based
and has no phone flow without an SMS provider, so each account carries a synthetic address
derived from the number (`0771111111@quickwash.local`). Nobody sees it and nothing is sent to
it; `phoneToAuthEmail` in `src/lib/supabase/env.ts` is the whole of the mapping.

Notifications are stored in-app; the SRS allows WhatsApp or SMS to be added later, and
`src/lib/notifications.ts` is the single place to do it.

A customer's order pages update live (FR-018). `src/components/live-orders.tsx` subscribes over
Supabase Realtime - a WebSocket the project already provides - to changes on the customer's own
rows in `laundry_orders`, and re-renders the page from the server when one arrives. Row level
security decides what the socket is sent, so no new authorisation exists for it. The one
requirement is that `laundry_orders` is in the `supabase_realtime` publication; the block at the
end of `supabase/schema.sql` (or the snippet of the same date) does that.

## How it is put together

```
src/
  lib/
    supabase/        server.ts (cookie-bound), admin.ts (service role), browser.ts (Realtime), env.ts
    auth.ts          who is signed in, and requireUser()
    types.ts         roles, the ten order statuses, domain records
    orders.ts        the state machine and business rules BR-001..BR-010
    repos.ts         users, addresses, shops, settings
    notifications.ts the SRS section 19 fan-out
    notification-events.ts  the recipient matrix, shared with the seeder
    validation.ts    zod schemas for every request body
    api.ts           the { ok, data } envelope and error-to-status mapping
  middleware.ts      refreshes the session; bounces signed-out visitors
  app/
    api/             31 route handlers, matching SRS section 14
    login, register  signed-out screens
    customer/        SRS 13.1
    agent/           SRS 13.2
    shop/            SRS 13.3
    admin/           SRS 13.4
  components/
    ui/            shadcn/ui primitives, owned in-tree and edited freely
    patterns.tsx   QuickWash screen patterns composed from those primitives
    field.tsx      the label/hint/error contract every form control reads
    app-shell.tsx  role guard and chrome; nav.tsx, order-card.tsx, pipeline-rail.tsx
scripts/
  seed.ts            seeds orders sitting at every stage of the pipeline
  acceptance.mjs     48 checks through the app, over real HTTP
  rls.mjs            21 checks around it, straight at PostgREST
supabase/
  schema.sql         tables, views, policies and the functions that write
  README.md          setup, and what the policies say in words
```

### The order state machine

`src/lib/orders.ts` is the single gate for every status change. It enforces:

- **BR-006** - only the transitions drawn in SRS section 9 are allowed; a delivered order cannot
  move backwards.
- **BR-007** - every change writes a row to `order_status_history`, including the initial
  `PENDING`, so the customer's trail is complete.
- **BR-003/BR-004/BR-005/BR-010** - the role making the change must be permitted to reach that
  status, and an agent may only touch orders assigned to them.
- **FR-014 before FR-015** - an order cannot be marked `READY` until the shop has set its price,
  because READY is the notification that tells the customer what they owe. The shop screen
  disables the button; `transition_order()` refuses the move.
- **BR-002** - order numbers (`PU-2026-0001`) come from a per-year counter incremented in a
  single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` inside the same transaction as the
  insert, so two simultaneous requests cannot take the same number.

PostgREST has no client-side transaction, so the writes that must land together are Postgres
functions: `create_order`, `transition_order`, `set_order_price`. Each one is
`security definer` and **re-checks the caller** - the anon key ships to the browser, so "the app
already checked" is not a check. The transition table and the role map therefore exist twice, in
`src/lib/orders.ts` and in `schema.sql`; the first shapes the UI, the second is the one that
holds.

### Access control

Four layers, and only the last one is load-bearing.

`src/middleware.ts` refreshes the session and bounces a signed-out visitor off the role sections
before a page renders. `requireUser(...roles)` guards the API and `AppShell` guards the pages,
redirecting a wrong-role visitor to their own home. `canViewOrder` shapes what a screen offers.

Working out who is asking costs no network call: `getClaims()` verifies the access token's
signature against the project's public key locally, and the `sync_user_claims` trigger keeps the
role and shop in the token so there is nothing to look up. That is a token, so it is a snapshot — which
is why `updateUser()` ends the sessions of anyone whose shop or active flag changed, and why the
sentence below still ends the argument.

**Row level security is what actually enforces it.** Every query runs as the signed-in person, so
a request for more than you should see comes back empty rather than leaking. `can_view_order()`
in `schema.sql` is BR-008; `supabase/README.md` states the rest in words.

---

## The interface

**Typeface.** Manrope carries the whole product, loaded once in `app/layout.tsx`. Titles are set
with `tracking-tighter` so a heading reads as one object rather than a row of words; body copy is
left at its natural width. JetBrains Mono is kept for one job only - order numbers, counts and
timestamps, which need to line up in a column.

**Palette.** Six named colours, declared at the top of `app/globals.css` and taken from the
materials of the place the service runs in: the salt pans north of Puttalam (`ground`), indigo dye
(`ink`), and the lagoon (`lagoon`, the single accent). Amber (`sun`) marks work waiting on someone
and rose (`flag`) marks work that failed. Nothing else is a colour.

**Components.** `components/ui/` holds shadcn/ui primitives - button, card, input, textarea, label,
badge, select, separator, table, alert, skeleton and dropdown-menu. They are ours to edit: the
button carries two extra QuickWash variants (`accent` for the one forward action on a screen,
`danger` for reversible destructive work).

Screens never import a primitive directly. They import `components/patterns.tsx`, which composes
them into the pieces the app actually repeats - `PageTitle`, `SectionHeading`, `Card`, `Figure`,
`StatusPill`, `EmptyState`, `Notice`, `Button`. That is the seam that keeps eleven order statuses
looking the same on four different dashboards.

The shadcn tokens (`--primary`, `--muted`, `--ring`, ...) are mapped onto the QuickWash palette in
`globals.css`, so a component added later with `npx shadcn@latest add` arrives already in the
brand rather than in default slate.

**Forms.** `Field` owns the id that ties a label, its hint and its error to the control, and passes
it down through context - so `Input`, `Textarea` and `SelectTrigger` are correctly labelled and
`aria-describedby`/`aria-invalid` are set without any call site having to invent an id. Controls are
44px tall, which is also the minimum tap target.

---

## What was verified

Two suites, checking different things. Both run against the built app.

```bash
npm run build && npx next start -p 3021 &
npm run test:acceptance -- http://localhost:3021   # 48 checks, through the app
npm run test:rls                                   # 21 checks, around it
```

**`test:acceptance`** is the SRS section 20 loop end to end: register -> request pickup ->
admin assigns -> agent collects -> shop receives, washes, dries, irons, prices, marks ready ->
admin assigns delivery -> agent delivers -> customer sees the completed order. Plus the negative
access checks, five concurrent order requests taking five distinct numbers, case-insensitive
search, a price of `1234.56` surviving as a number, a shop refused `READY` until it has priced
the order, and status history. **48/48.**

**`test:rls`** talks straight to PostgREST with the anon key - the same key that ships to the
browser - as a signed-in customer, with the app taken out of the way. It tries what someone with
a developer console would try: read another customer's order, forge a history row, write a
notification to somebody else, jump an order to `DELIVERED`, set their own price,
make themselves an administrator. **21/21.**

That last one is why the suite exists. Its first run found that a customer could promote
themselves to `ADMIN`: row level security grants or denies a whole row, so "you may edit your own
profile" also meant "you may edit your own `role`". The `guard_user_columns` trigger in
`schema.sql` is there because of it.

**Every page for every role** renders 200 with no server-component error, the middleware bounces
a signed-out visitor with a 307, and the role guards redirect correctly.

---

## Scope notes

In scope and built: registration and login, profile, addresses, pickup requests, order creation
and tracking, agent assignment and pickup, shop processing and pricing, delivery, order and status
history, QR codes, in-app notifications, and the admin dashboard, customer, agent, shop, report
and settings screens.

Deliberately not built, per SRS section 5.2: AI classification, route optimisation, GPS tracking,
online payments, subscriptions, loyalty, multiple cities, and native apps. Section 24 lists these
as the path after the model is validated.

Two gaps worth naming. FR-022 (batch pickup routes) was built and then removed on request, so
orders per pickup route - the second of the three metrics SRS section 23 calls most important -
is no longer measured; agents are assigned one order at a time. And the reports screen cannot
compute contribution margin, because pickup and delivery cost per order are not captured
anywhere in the system - that is the third of those metrics.
