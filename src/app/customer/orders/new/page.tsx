import { requireRole } from "@/components/app-shell";
import { ButtonLink, EmptyState, PageTitle } from "@/components/patterns";
import { listAddresses } from "@/lib/repos";
import { NewOrderForm } from "./new-order-form";

export const metadata = { title: "Request a pickup · QuickWash" };

/** SRS 13.1 screens 4-6: create pickup, choose address, confirm. */
export default async function NewOrderPage() {
  const user = await requireRole("CUSTOMER");
  const addresses = await listAddresses(user.id);

  return (
    <>
      <PageTitle
        eyebrow="New request"
        title="Request a pickup"
        subtitle="Pick where and when. You will get the price once the shop has sorted and counted your items."
      />

      {addresses.length === 0 ? (
        <EmptyState
          title="Add an address first"
          body="We collect from your door, so we need to know where that is. It takes a moment and you only do it once."
          action={
            <ButtonLink href="/customer/addresses" tone="accent">
              Add an address
            </ButtonLink>
          }
        />
      ) : (
        <NewOrderForm addresses={addresses} />
      )}
    </>
  );
}
