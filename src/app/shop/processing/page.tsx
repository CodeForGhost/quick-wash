import { requireRole } from "@/components/app-shell";
import { ShopQueue } from "@/components/shop-queue";
import { PageTitle } from "@/components/patterns";
import { listOrders } from "@/lib/orders";

export const metadata = { title: "Processing · QuickWash" };

/** SRS 13.3 screen 5 / FR-013. */
export default async function ShopProcessingPage() {
  const user = await requireRole("SHOP_STAFF");
  const orders = listOrders({
    shopId: user.shop_id ?? undefined,
    statuses: ["AT_LAUNDRY", "WASHING", "DRYING", "IRONING"],
  });

  return (
    <>
      <PageTitle
        eyebrow="On the floor"
        title="Processing"
        subtitle="Everything currently being washed, dried or pressed. Open an order to move it to the next step."
      />
      <ShopQueue
        orders={orders}
        empty={{
          title: "Nothing in process",
          body: "Confirm an incoming order at the counter and it will appear here.",
        }}
      />
    </>
  );
}
