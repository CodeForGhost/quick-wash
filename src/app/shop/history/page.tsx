import { requireRole } from "@/components/app-shell";
import { ShopQueue } from "@/components/shop-queue";
import { Figure, PageTitle } from "@/components/patterns";
import { formatPrice } from "@/lib/format";
import { listOrders } from "@/lib/orders";

export const metadata = { title: "History · QuickWash" };

/** SRS 13.3 screen 7. */
export default async function ShopHistoryPage() {
  const user = await requireRole("SHOP_STAFF");
  const orders = listOrders({ shopId: user.shop_id ?? undefined, statuses: ["DELIVERED"] });

  const revenue = orders.reduce((total, order) => total + (order.price ?? 0), 0);
  const items = orders.reduce((total, order) => total + (order.item_count ?? 0), 0);

  return (
    <>
      <PageTitle eyebrow="Closed" title="Completed orders" subtitle="Everything this shop has finished and sent back." />

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Figure value={orders.length} label="Orders completed" />
        <Figure value={formatPrice(revenue)} label="Billed" tone="lagoon" />
        <Figure value={items} label="Items handled" />
      </div>

      <ShopQueue
        orders={orders}
        empty={{
          title: "No completed orders yet",
          body: "Orders land here once the delivery agent hands them back to the customer.",
        }}
      />
    </>
  );
}
