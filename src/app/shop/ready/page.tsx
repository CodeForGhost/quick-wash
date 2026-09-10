import { requireRole } from "@/components/app-shell";
import { ShopQueue } from "@/components/shop-queue";
import { PageTitle, SectionHeading } from "@/components/patterns";
import { listOrders } from "@/lib/orders";

export const metadata = { title: "Ready · QuickWash" };

/** SRS 13.3 screen 6 / FR-015. */
export default async function ShopReadyPage() {
  const user = await requireRole("SHOP_STAFF");
  const shopId = user.shop_id ?? undefined;
  const [ready, out] = await Promise.all([
    listOrders({ shopId, statuses: ["READY"] }),
    listOrders({ shopId, statuses: ["OUT_FOR_DELIVERY"] }),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Finished"
        title="Ready orders"
        subtitle="Washed, pressed and waiting for an agent to take them back."
      />

      <section className="mb-8">
        <SectionHeading eyebrow="Waiting for an agent" title="On the shelf" />
        <ShopQueue
          orders={ready}
          empty={{
            title: "Nothing ready yet",
            body: "Once you mark an order ready, it waits here until an administrator assigns a delivery agent.",
          }}
        />
      </section>

      {out.length > 0 ? (
        <section>
          <SectionHeading eyebrow="Gone out" title="With the delivery agent" />
          <ShopQueue orders={out} empty={{ title: "", body: "" }} />
        </section>
      ) : null}
    </>
  );
}
