import { requireRole } from "@/components/app-shell";
import { PageTitle } from "@/components/patterns";
import { listShops } from "@/lib/repos";
import { ShopManager } from "./shop-manager";

export const metadata = { title: "Laundry shops · QuickWash" };

/** FR-026: laundry shop management. The MVP runs with one active shop. */
export default async function AdminShopsPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageTitle
        eyebrow="Where the washing happens"
        title="Laundry shops"
        subtitle="New orders go to the first active shop. Keep one active while you are validating the service."
      />
      <ShopManager shops={listShops()} />
    </>
  );
}
