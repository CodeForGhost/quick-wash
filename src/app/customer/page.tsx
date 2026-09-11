import Link from "next/link";
import { requireRole } from "@/components/app-shell";
import { LiveOrders } from "@/components/live-orders";
import { NotifyOptIn } from "@/components/notify-opt-in";
import { OrderCard } from "@/components/order-card";
import { PipelineRail } from "@/components/pipeline-rail";
import { ButtonLink, Card, EmptyState, PageTitle, SectionHeading, StatusPill } from "@/components/patterns";
import { formatDate, formatPrice } from "@/lib/format";
import { listOrders } from "@/lib/orders";
import { listAddresses } from "@/lib/repos";

export const metadata = { title: "Home · QuickWash" };

/** SRS 13.1 screen 3: the customer's home, built around the order in flight. */
export default async function CustomerHome() {
  const user = await requireRole("CUSTOMER");
  const [orders, addresses] = await Promise.all([
    listOrders({ customerId: user.id }),
    listAddresses(user.id),
  ]);

  const active = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED");
  const past = orders.filter((order) => order.status === "DELIVERED");
  const current = active[0];

  return (
    <>
      <LiveOrders customerId={user.id} />
      <PageTitle
        eyebrow={"Hello, " + user.name.split(" ")[0]}
        title={current ? "Your laundry is on its way" : "Ready when you are"}
        subtitle={
          current
            ? "Follow every step below. We will send an update as each one happens."
            : "Tell us when to come, and an agent will collect your bags from your door."
        }
      />
      <NotifyOptIn />

      {addresses.length === 0 ? (
        <Card className="mb-6 border-sun/30 bg-sun-soft p-4">
          <p className="font-semibold text-ink">Add a pickup address first</p>
          <p className="mt-1 text-sm text-ink-soft">
            We need to know where to collect from before you can book a pickup.
          </p>
          <ButtonLink href="/customer/addresses" tone="accent" className="mt-3">
            Add an address
          </ButtonLink>
        </Card>
      ) : null}

      {current ? (
        <Card className="mb-8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Current order</p>
              <p className="tabular mt-1 font-display text-2xl font-bold text-ink">{current.order_number}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {current.bag_count} {current.bag_count === 1 ? "bag" : "bags"} ·{" "}
                {formatDate(current.pickup_date)} · {current.pickup_time_slot}
              </p>
            </div>
            <div className="text-right">
              <StatusPill status={current.status} />
              <p className="tabular mt-2 text-sm font-semibold text-ink">
                {current.price ? formatPrice(current.price) : "Price after sorting"}
              </p>
            </div>
          </div>

          <PipelineRail status={current.status} className="mt-6" />

          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href={`/customer/orders/${current.id}`} tone="accent">
              Track this order
            </ButtonLink>
            {addresses.length > 0 ? (
              <ButtonLink href="/customer/orders/new" tone="quiet">
                Request another pickup
              </ButtonLink>
            ) : null}
            {current.pickup_agent_phone ? (
              <a
                href={`tel:${current.pickup_agent_phone}`}
                className="inline-flex items-center rounded-full border border-hairline px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink-faint"
              >
                Call {current.pickup_agent_name?.split(" ")[0]}
              </a>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="mb-8 p-6">
          <div className="sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="font-display tracking-tighter text-xl font-semibold text-ink">Book your next pickup</p>
              <p className="mt-1 max-w-md text-sm text-ink-soft">
                Choose a day and a two-hour window. One agent collects several homes on the same round, so the
                trip costs less.
              </p>
            </div>
            <ButtonLink
              href="/customer/orders/new"
              tone="accent"
              className="mt-4 w-full sm:mt-0 sm:w-auto sm:shrink-0"
            >
              Request a pickup
            </ButtonLink>
          </div>
        </Card>
      )}

      {active.length > 1 ? (
        <section className="mb-8">
          <SectionHeading eyebrow="In progress" title="Your other orders" />
          <div className="grid gap-3 sm:grid-cols-2">
            {active.slice(1).map((order) => (
              <OrderCard key={order.id} order={order} href={`/customer/orders/${order.id}`} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          eyebrow="Finished"
          title="Recent orders"
          action={
            past.length > 0 ? (
              <Link href="/customer/orders" className="text-sm font-semibold text-lagoon underline underline-offset-4">
                See all
              </Link>
            ) : null
          }
        />
        {past.length === 0 ? (
          <EmptyState
            title="No finished orders yet"
            body="Once your first laundry comes back, it will be listed here with the price you paid."
            action={
              addresses.length > 0 ? (
                <ButtonLink href="/customer/orders/new" tone="accent">
                  Request a pickup
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {past.slice(0, 4).map((order) => (
              <OrderCard key={order.id} order={order} href={`/customer/orders/${order.id}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
