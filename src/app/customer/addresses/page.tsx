import { requireRole } from "@/components/app-shell";
import { PageTitle } from "@/components/patterns";
import { listAddresses } from "@/lib/repos";
import { AddressBook } from "./address-book";

export const metadata = { title: "Addresses · QuickWash" };

/** SRS 13.1 screen 11 / FR-004: saved pickup addresses. */
export default async function AddressesPage() {
  const user = await requireRole("CUSTOMER");
  return (
    <>
      <PageTitle
        eyebrow="Where we collect"
        title="Your addresses"
        subtitle="Save the places we should collect from. You pick one each time you book."
      />
      <AddressBook initial={await listAddresses(user.id)} defaultPhone={user.phone} />
    </>
  );
}
