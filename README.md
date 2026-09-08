# QuickWash Pickup & Management System

An MVP implementation of [`srs-doc.md`](./srs-doc.md): customers request a laundry pickup, one
agent collects several homes on a single round, the laundry shop processes and prices the order,
and the customer follows it until it comes back clean.

Built with **Next.js 15** (App Router, TypeScript, Tailwind CSS v4), **shadcn/ui** and **SQLite**.

---

## Running it

```bash
npm install
npm run db:seed     # creates data/laundry.db with a shop, staff, agents, customers and orders
npm run dev         # http://localhost:3000
```

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

`npm run db:reset` deletes the database and reseeds from scratch.

---

## Deviation from the SRS

The SRS recommends PostgreSQL + Prisma and a separate Node backend (section 15/16). This build
uses **SQLite** as requested, accessed through `better-sqlite3` with hand-written SQL, and runs
the API as Next.js route handlers rather than a separate service. Everything else follows the
document. The schema in `src/lib/schema.ts` is a direct translation of SRS section 10, so moving
to PostgreSQL later is mostly a driver swap.

Authentication uses phone number + password, which the SRS names as the acceptable starting
point (OTP is listed as a later improvement). Notifications are stored in-app; the SRS allows
WhatsApp or SMS to be added later, and `src/lib/notifications.ts` is the single place to do it.

---

## How it is put together

```
src/
  lib/
    schema.ts        SQLite schema - SRS section 10, as one bundled string
    db.ts            connection, WAL, typed all/get/run helpers
    types.ts         roles, the ten order statuses, domain records
    orders.ts        the state machine, order numbering, and business rules BR-001..BR-010
    repos.ts         users, addresses, shops, routes, settings
    notifications.ts the SRS section 19 recipient matrix
    auth.ts          sessions and requireUser(); password.ts holds the hashing
    validation.ts    zod schemas for every request body
    api.ts           the { ok, data } envelope and error-to-status mapping
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
scripts/seed.ts      seeds orders sitting at every stage of the pipeline
```

### The order state machine

`src/lib/orders.ts` is the single gate for every status change. It enforces:

- **BR-006** - only the transitions drawn in SRS section 9 are allowed; a delivered order cannot
  move backwards.
- **BR-007** - every change writes a row to `order_status_history`, including the initial
  `PENDING`, so the customer's trail is complete.
- **BR-003/BR-004/BR-005/BR-010** - the role making the change must be permitted to reach that
  status, and an agent may only touch orders assigned to them.
- **BR-002** - order numbers (`PU-2026-0001`) come from a per-year counter updated inside the
  same transaction as the insert.

### Access control

`requireUser(...roles)` guards the API; `AppShell` guards the pages, redirecting a signed-out
visitor to `/login` and a wrong-role visitor to their own home. `canViewOrder` implements
BR-008 - a customer only ever sees their own orders.

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

Both checks below run against the built app over real HTTP.

**The SRS section 20 acceptance loop**, end to end: register → request pickup → admin assigns →
agent collects → shop receives, washes, dries, irons, prices, marks ready → admin assigns
delivery → agent delivers → customer sees the completed order. Plus status history, notifications,
QR generation, and FR-022 batch routes. Alongside it, the access rules were checked negatively:
another customer reading the order (403), a customer assigning an agent (403), an agent setting
shop status (403), a customer setting the price (403), a backwards transition (409), and an
unauthenticated request (401). **34/34 passed.**

**Every page for every role** renders 200 with no server-component error, and the role guards
redirect correctly.

There is no automated test suite in the repo - the checks above were run as throwaway harnesses
against the running server. If this goes past a pilot, those are worth committing as real tests.

---

## Scope notes

In scope and built: registration and login, profile, addresses, pickup requests, order creation
and tracking, agent assignment and pickup, shop processing and pricing, delivery, order and status
history, QR codes, in-app notifications, batch pickup routes, and the admin dashboard, customer,
agent, shop, route, report and settings screens.

Deliberately not built, per SRS section 5.2: AI classification, route optimisation, GPS tracking,
online payments, subscriptions, loyalty, multiple cities, and native apps. Section 24 lists these
as the path after the model is validated.

One gap worth naming: the reports screen cannot compute contribution margin, because pickup and
delivery cost per order are not captured anywhere in the system. Recording an agent's cost per
round against `pickup_routes` would close it - that is the third of the three metrics SRS section
23 calls most important.
