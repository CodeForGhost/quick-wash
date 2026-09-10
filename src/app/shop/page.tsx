import { requireRole } from "@/components/app-shell";
import { ShopQueue } from "@/components/shop-queue";
import { Figure, PageTitle, SectionHeading } from "@/components/patterns";
import { listOrders, statusCounts } from "@/lib/orders";
import { OrderLookup } from "./order-lookup";

export const metadata = { title: "Counter · QuickWash" };

/** SRS 13.3 screens 2-3 / FR-012: laundry arriving at the shop. */
export default async function ShopDashboard() {
  const user = await requireRole("SHOP_STAFF");
  const shopId = user.shop_id ?? undefined;

  // Four independent queries; one wave rather than four round trips.
  const [counts, incoming, processing, ready] = await Promise.all([
    statusCounts(),
    listOrders({ shopId, statuses: ["PICKED_UP"] }),
    listOrders({ shopId, statuses: ["AT_LAUNDRY", "WASHING", "DRYING", "IRONING"] }),
    listOrders({ shopId, statuses: ["READY"] }),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Laundry shop"
        title="The counter"
        subtitle="Confirm what arrives, then move each order along as it is washed, dried and pressed."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={incoming.length} label="Arriving" tone="sun" href="/shop" />
        <Figure value={processing.length} label="In process" href="/shop/processing" />
        <Figure value={ready.length} label="Ready to go" tone="lagoon" href="/shop/ready" />
        <Figure value={counts.DELIVERED ?? 0} label="Completed" href="/shop/history" />
      </div>

      <div className="mb-8">
        <OrderLookup />
      </div>

      <section className="mb-8">
        <SectionHeading eyebrow="FR-012" title="Incoming laundry" />
        <ShopQueue
          orders={incoming}
          showPrice={false}
          empty={{
            title: "Nothing on its way in",
            body: "Orders show up here the moment an agent marks them collected. Confirm each one as it reaches the counter.",
          }}
        />
      </section>

      {processing.length > 0 ? (
        <section>
          <SectionHeading eyebrow="On the floor" title="Being processed" />
          <ShopQueue
            orders={processing.slice(0, 5)}
            empty={{ title: "Nothing in process", body: "Confirm an incoming order to start it." }}
          />
        </section>
      ) : null}
    </>
  );
}
